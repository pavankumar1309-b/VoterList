import React, { useEffect, useState } from 'react';
import { AlertCircle, Trash2, UserPlus, X } from 'lucide-react';
import type { AuthUser } from '../types.ts';

interface OfficerManagementModalProps {
  isOpen: boolean;
  authToken: string;
  currentUserId: string;
  onClose: () => void;
}

export const OfficerManagementModal: React.FC<OfficerManagementModalProps> = ({
  isOpen,
  authToken,
  currentUserId,
  onClose,
}) => {
  const [officers, setOfficers] = useState<AuthUser[]>([]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'officer' | 'admin'>('officer');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadOfficers = async () => {
    try {
      const res = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { users: AuthUser[] };
      setOfficers(data.users || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadOfficers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ username, displayName, password, role }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Could not add officer.');
        return;
      }
      setUsername('');
      setDisplayName('');
      setPassword('');
      await loadOfficers();
    } catch {
      setError('Failed to create authorized officer account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        await loadOfficers();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="officer-mgmt-title"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="officer-mgmt-title" className="font-display text-lg font-semibold text-slate-900">
              Authorized Officers
            </h2>
            <p className="text-xs text-slate-500">
              Manage personnel permitted to upload and query electoral lists.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              minLength={2}
              placeholder="Officer Full Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0F2942] focus:outline-none"
            />
            <input
              type="text"
              required
              minLength={3}
              placeholder="Officer ID / Email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0F2942] focus:outline-none"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0F2942] focus:outline-none"
            />
            <div className="flex gap-2">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value === 'admin' ? 'admin' : 'officer')}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0F2942] focus:outline-none"
              >
                <option value="officer">Officer</option>
                <option value="admin">Administrator</option>
              </select>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white hover:bg-[#173B5E] whitespace-nowrap"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            {officers.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                No additional officer accounts registered in memory yet.
              </p>
            ) : (
              officers.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{u.displayName}</p>
                    <p className="text-xs text-slate-500">
                      {u.username} · {u.role === 'admin' ? 'Administrator' : 'Officer'}
                    </p>
                  </div>
                  {u.id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => handleDelete(u.id)}
                      className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Revoke</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
