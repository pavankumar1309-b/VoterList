import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { SessionState } from './types.ts';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_SESSIONS = 200;

const sessionsById = new Map<string, SessionState>();

function pruneExpiredSessions(): void {
  const now = Date.now();
  for (const [id, sess] of sessionsById.entries()) {
    if (now - sess.lastAccessedAt > SESSION_TTL_MS) {
      sess.dataset = null;
      sess.searchHistory = [];
      sess.recentVoters = [];
      sessionsById.delete(id);
    }
  }
  while (sessionsById.size > MAX_SESSIONS) {
    const oldestKey = sessionsById.keys().next().value;
    if (!oldestKey) break;
    const oldest = sessionsById.get(oldestKey);
    if (oldest) {
      oldest.dataset = null;
      oldest.searchHistory = [];
      oldest.recentVoters = [];
    }
    sessionsById.delete(oldestKey);
  }
}

export function getOrCreateSession(rawSessionId?: string): SessionState {
  pruneExpiredSessions();

  const sanitized =
    rawSessionId && /^[a-zA-Z0-9_-]{8,80}$/.test(rawSessionId.trim())
      ? rawSessionId.trim()
      : 'default-session';

  const existing = sessionsById.get(sanitized);
  if (existing) {
    existing.lastAccessedAt = Date.now();
    return existing;
  }

  const now = Date.now();
  const created: SessionState = {
    sessionId: sanitized || crypto.randomUUID(),
    createdAt: now,
    lastAccessedAt: now,
    dataset: null,
    searchHistory: [],
    recentVoters: [],
  };
  sessionsById.set(created.sessionId, created);
  return created;
}

export function purgeSession(sessionId: string): void {
  const sess = sessionsById.get(sessionId);
  if (sess) {
    sess.dataset = null;
    sess.searchHistory = [];
    sess.recentVoters = [];
    sessionsById.delete(sessionId);
  }
}

export interface SessionRequest extends Request {
  session?: SessionState;
}

export function attachSession(req: SessionRequest, _res: Response, next: NextFunction): void {
  const headerId = typeof req.headers['x-session-id'] === 'string' ? req.headers['x-session-id'] : undefined;
  req.session = getOrCreateSession(headerId);
  next();
}
