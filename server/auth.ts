import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser, SessionState } from './types.ts';

interface StoredUser extends AuthUser {
  passwordHash: string;
  salt: string;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const usersByUsername = new Map<string, StoredUser>();
const sessionsById = new Map<string, SessionState>();

function getConfiguredAccessCode(): string {
  return (process.env.ADMIN_ACCESS_CODE || '').trim();
}

export function isFirstRunSetupRequired(): boolean {
  return getConfiguredAccessCode().length === 0 && usersByUsername.size === 0;
}

export function isAccessCodeConfigured(): boolean {
  return getConfiguredAccessCode().length > 0;
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (derived.length !== storedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, storedBuf);
}

function verifyAccessCode(inputCode: string): boolean {
  const configured = getConfiguredAccessCode();
  if (!configured) {
    return false;
  }
  const a = Buffer.from(inputCode, 'utf8');
  const b = Buffer.from(configured, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function signToken(tokenId: string, expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({ tid: tokenId, exp: expiresAt })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyTokenSignature(token: string): { tid: string; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      tid?: unknown;
      exp?: unknown;
    };
    if (typeof decoded.tid !== 'string' || typeof decoded.exp !== 'number') {
      return null;
    }
    if (Date.now() > decoded.exp) {
      return null;
    }
    return { tid: decoded.tid, exp: decoded.exp };
  } catch {
    return null;
  }
}

export function createSessionForUser(user: AuthUser): { token: string; session: SessionState } {
  const tokenId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const session: SessionState = {
    tokenId,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    createdAt: now,
    expiresAt,
    dataset: null,
    searchHistory: [],
    recentVoters: [],
  };
  sessionsById.set(tokenId, session);
  const token = signToken(tokenId, expiresAt);
  return { token, session };
}

export function claimInitialAdmin(
  usernameInput: string,
  displayNameInput: string,
  passwordInput: string
): { ok: true; user: AuthUser; token: string } | { ok: false; error: string; status: number } {
  if (!isFirstRunSetupRequired()) {
    return {
      ok: false,
      error: 'System initialization is already complete. Please sign in with authorized credentials.',
      status: 409,
    };
  }

  const username = usernameInput.trim().toLowerCase();
  const displayName = displayNameInput.trim();
  if (username.length < 3 || username.length > 80) {
    return { ok: false, error: 'Officer ID or email must be between 3 and 80 characters.', status: 400 };
  }
  if (displayName.length < 2 || displayName.length > 80) {
    return { ok: false, error: 'Officer full name must be between 2 and 80 characters.', status: 400 };
  }
  if (passwordInput.length < 8 || passwordInput.length > 128) {
    return { ok: false, error: 'Password must be between 8 and 128 characters.', status: 400 };
  }

  const { hash, salt } = hashPassword(passwordInput);
  const storedUser: StoredUser = {
    id: crypto.randomUUID(),
    username,
    displayName,
    role: 'admin',
    createdAt: new Date().toISOString(),
    passwordHash: hash,
    salt,
  };
  usersByUsername.set(username, storedUser);

  const publicUser: AuthUser = {
    id: storedUser.id,
    username: storedUser.username,
    displayName: storedUser.displayName,
    role: storedUser.role,
    createdAt: storedUser.createdAt,
  };
  const { token } = createSessionForUser(publicUser);
  return { ok: true, user: publicUser, token };
}

export function authenticateUser(
  usernameInput: string,
  passwordInput: string
): { ok: true; user: AuthUser; token: string } | { ok: false; error: string; status: number } {
  const username = usernameInput.trim().toLowerCase();
  if (!username || !passwordInput) {
    return { ok: false, error: 'Officer ID and password/access code are required.', status: 400 };
  }

  // If ADMIN_ACCESS_CODE is configured, allow officer login with the configured server access code
  if (isAccessCodeConfigured() && verifyAccessCode(passwordInput)) {
    const existing = usersByUsername.get(username);
    const user: AuthUser = existing
      ? {
          id: existing.id,
          username: existing.username,
          displayName: existing.displayName,
          role: existing.role,
          createdAt: existing.createdAt,
        }
      : {
          id: `env-${crypto.createHash('sha256').update(username).digest('hex').slice(0, 12)}`,
          username,
          displayName: usernameInput.trim(),
          role: 'admin',
          createdAt: new Date().toISOString(),
        };
    const { token } = createSessionForUser(user);
    return { ok: true, user, token };
  }

  const stored = usersByUsername.get(username);
  if (!stored || !verifyPassword(passwordInput, stored.passwordHash, stored.salt)) {
    return { ok: false, error: 'Invalid Officer ID or password.', status: 401 };
  }

  const user: AuthUser = {
    id: stored.id,
    username: stored.username,
    displayName: stored.displayName,
    role: stored.role,
    createdAt: stored.createdAt,
  };
  const { token } = createSessionForUser(user);
  return { ok: true, user, token };
}

export function createAuthorizedOfficer(
  usernameInput: string,
  displayNameInput: string,
  passwordInput: string,
  role: 'admin' | 'officer'
): { ok: true; user: AuthUser } | { ok: false; error: string; status: number } {
  const username = usernameInput.trim().toLowerCase();
  const displayName = displayNameInput.trim();
  if (username.length < 3 || username.length > 80) {
    return { ok: false, error: 'Officer ID or email must be between 3 and 80 characters.', status: 400 };
  }
  if (displayName.length < 2 || displayName.length > 80) {
    return { ok: false, error: 'Officer full name must be between 2 and 80 characters.', status: 400 };
  }
  if (passwordInput.length < 8 || passwordInput.length > 128) {
    return { ok: false, error: 'Password must be between 8 and 128 characters.', status: 400 };
  }
  if (usersByUsername.has(username)) {
    return { ok: false, error: 'An officer with that ID already exists.', status: 409 };
  }

  const { hash, salt } = hashPassword(passwordInput);
  const storedUser: StoredUser = {
    id: crypto.randomUUID(),
    username,
    displayName,
    role,
    createdAt: new Date().toISOString(),
    passwordHash: hash,
    salt,
  };
  usersByUsername.set(username, storedUser);
  return {
    ok: true,
    user: {
      id: storedUser.id,
      username: storedUser.username,
      displayName: storedUser.displayName,
      role: storedUser.role,
      createdAt: storedUser.createdAt,
    },
  };
}

export function listAuthorizedOfficers(): AuthUser[] {
  return Array.from(usersByUsername.values()).map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    createdAt: u.createdAt,
  }));
}

export function deleteAuthorizedOfficer(userId: string, actingUserId: string): boolean {
  if (userId === actingUserId) {
    return false;
  }
  for (const [uname, user] of usersByUsername.entries()) {
    if (user.id === userId) {
      usersByUsername.delete(uname);
      // Revoke active sessions for that user
      for (const [tid, sess] of sessionsById.entries()) {
        if (sess.userId === userId) {
          sess.dataset = null;
          sess.searchHistory = [];
          sess.recentVoters = [];
          sessionsById.delete(tid);
        }
      }
      return true;
    }
  }
  return false;
}

export function destroySession(tokenId: string): void {
  const sess = sessionsById.get(tokenId);
  if (sess) {
    sess.dataset = null;
    sess.searchHistory = [];
    sess.recentVoters = [];
    sessionsById.delete(tokenId);
  }
}

export interface AuthenticatedRequest extends Request {
  session?: SessionState;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in to access voter records.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const verified = verifyTokenSignature(token);
  if (!verified) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  const session = sessionsById.get(verified.tid);
  if (!session || Date.now() > session.expiresAt) {
    if (session) {
      destroySession(verified.tid);
    }
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  req.session = session;
  next();
}
