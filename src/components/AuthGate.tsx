import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import type { AuthUser } from '../types.ts';

interface AuthGateProps {
  needsSetup: boolean;
  accessCodeConfigured: boolean;
  onAuthenticated: (user: AuthUser, token: string) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  needsSetup,
  accessCodeConfigured,
  onAuthenticated,
}) => {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (needsSetup) {
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify both entries.');
        return;
      }
      if (password.length < 8) {
        setError('Officer password must be at least 8 characters long.');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = needsSetup ? '/api/auth/setup' : '/api/auth/login';
      const payload = needsSetup
        ? { username: username.trim(), displayName: displayName.trim(), password }
        : { username: username.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        user?: AuthUser;
        token?: string;
        error?: string;
      };

      if (!res.ok || !data.user || !data.token) {
        setError(data.error || 'Authentication failed. Please check your credentials.');
        return;
      }

      onAuthenticated(data.user, data.token);
    } catch {
      setError('Unable to reach the authentication service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Civic Hairline */}
      <div className="h-1 w-full bg-gradient-to-r from-[#0F2942] via-[#D97706] to-[#0F2942]" />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Official Portal Masthead */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F2942] text-white">
              <ShieldCheck className="h-6 w-6 text-amber-400" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Smart Voter Search
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Authorized Electoral Roll Inspection &amp; Search Console
            </p>
          </div>

          {/* Auth Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {needsSetup ? 'Initialize Administrator Account' : 'Officer Sign In'}
              </h2>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                {needsSetup
                  ? 'First-time launch detected. Claim the primary officer account to secure voter list uploads and lookups.'
                  : accessCodeConfigured
                  ? 'Enter your Officer ID and the configured department access code or account password.'
                  : 'Sign in with your authorized Officer ID and password to access voter records.'}
              </p>
            </div>

            {needsSetup && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <span>
                  This setup form locks automatically once the first administrator account is created.
                </span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {needsSetup && (
                <div>
                  <label
                    htmlFor="auth-display-name"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Officer Full Name
                  </label>
                  <input
                    id="auth-display-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Rajeshwar Nair"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0F2942] focus:outline-none focus:ring-2 focus:ring-[#0F2942]/15"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-username"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Officer ID or Email
                </label>
                <input
                  id="auth-username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={80}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. officer.booth04@election.gov"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0F2942] focus:outline-none focus:ring-2 focus:ring-[#0F2942]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  {accessCodeConfigured && !needsSetup ? 'Access Code or Password' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={needsSetup ? 8 : 1}
                    maxLength={128}
                    autoComplete={needsSetup ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={needsSetup ? 'Minimum 8 characters' : 'Enter password'}
                    className="w-full rounded-lg border border-slate-300 bg-white pl-3.5 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0F2942] focus:outline-none focus:ring-2 focus:ring-[#0F2942]/15"
                  />
                  <KeyRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {needsSetup && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="auth-confirm-password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0F2942] focus:outline-none focus:ring-2 focus:ring-[#0F2942]/15"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F2942] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#173B5E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2942] focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {needsSetup ? (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>{loading ? 'Creating Account...' : 'Initialize & Sign In'}</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>{loading ? 'Verifying...' : 'Sign In to Console'}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Privacy Guarantee Footer */}
          <p className="mt-6 text-center text-xs text-slate-500 leading-relaxed">
            Voter lists are processed strictly inside your authenticated session and are never sent
            to external AI services or stored publicly.
          </p>
        </div>
      </div>
    </div>
  );
};
