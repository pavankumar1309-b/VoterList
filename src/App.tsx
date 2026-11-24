import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { AuthGate } from './components/AuthGate.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { FileUploadPanel } from './components/FileUploadPanel.tsx';
import { Header } from './components/Header.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { OfficerManagementModal } from './components/OfficerManagementModal.tsx';
import { SearchWorkspace } from './components/SearchWorkspace.tsx';
import { VoterDetailModal } from './components/VoterDetailModal.tsx';
import type {
  ActiveTab,
  AuthUser,
  DatasetSummary,
  PublicVoterRecord,
  RecentSearchEntry,
  SearchScope,
} from './types.ts';

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [accessCodeConfigured, setAccessCodeConfigured] = useState(false);

  // Session token kept strictly in React memory (never localStorage/sessionStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('search');
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [recentVoters, setRecentVoters] = useState<PublicVoterRecord[]>([]);
  const [searchHistory, setSearchHistory] = useState<RecentSearchEntry[]>([]);
  const [selectedVoter, setSelectedVoter] = useState<PublicVoterRecord | null>(null);
  const [officerModalOpen, setOfficerModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Cross-tab search presets
  const [presetQuery, setPresetQuery] = useState('');
  const [presetScope, setPresetScope] = useState<SearchScope>('all');
  const [presetStation, setPresetStation] = useState('all');

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const refreshAuthStatus = useCallback(async () => {
    setCheckingAuth(true);
    try {
      const res = await fetch('/api/auth/status');
      const data = (await res.json()) as {
        needsSetup: boolean;
        accessCodeConfigured: boolean;
      };
      setNeedsSetup(Boolean(data.needsSetup));
      setAccessCodeConfigured(Boolean(data.accessCodeConfigured));
    } catch {
      // ignore
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuthStatus();
  }, [refreshAuthStatus]);

  const refreshDashboardAndHistory = useCallback(async (token: string) => {
    try {
      const [dashRes, histRes] = await Promise.all([
        fetch('/api/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/history', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (dashRes.status === 401 || histRes.status === 401) {
        setAuthToken(null);
        setUser(null);
        setDataset(null);
        return;
      }

      if (dashRes.ok) {
        const dashData = (await dashRes.json()) as {
          hasDataset: boolean;
          dataset: DatasetSummary | null;
          recentVoters: PublicVoterRecord[];
        };
        setDataset(dashData.dataset);
        setRecentVoters(dashData.recentVoters || []);
      }

      if (histRes.ok) {
        const histData = (await histRes.json()) as {
          searchHistory: RecentSearchEntry[];
          recentVoters: PublicVoterRecord[];
        };
        setSearchHistory(histData.searchHistory || []);
        setRecentVoters(histData.recentVoters || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleAuthenticated = (authedUser: AuthUser, token: string) => {
    setUser(authedUser);
    setAuthToken(token);
    setNeedsSetup(false);
    setActiveTab('search');
    void refreshDashboardAndHistory(token);
  };

  const handleUploadSuccess = (summary: DatasetSummary) => {
    setDataset(summary);
    setRecentVoters([]);
    setSearchHistory([]);
    setPresetQuery('');
    setPresetScope('all');
    setPresetStation('all');
  };

  const handleOpenVoterDetails = async (voterId: string) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/voters/${encodeURIComponent(voterId)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { voter: PublicVoterRecord };
      setSelectedVoter(data.voter);
      void refreshDashboardAndHistory(authToken);
    } catch {
      // ignore
    }
  };

  const handlePurgeSession = async () => {
    if (!authToken) return;
    try {
      await fetch('/api/session/purge', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } catch {
      // ignore
    }
    setDataset(null);
    setRecentVoters([]);
    setSearchHistory([]);
    setSelectedVoter(null);
    setPresetQuery('');
    setPresetScope('all');
    setPresetStation('all');
    showToast('Uploaded voter data and session history deleted.');
  };

  const handleSignOut = async () => {
    if (authToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {
        // ignore
      }
    }
    setAuthToken(null);
    setUser(null);
    setDataset(null);
    setRecentVoters([]);
    setSearchHistory([]);
    setSelectedVoter(null);
    void refreshAuthStatus();
  };

  const handleClearHistory = async () => {
    if (!authToken) return;
    try {
      await fetch('/api/history', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setSearchHistory([]);
      setRecentVoters([]);
      showToast('Search history cleared.');
    } catch {
      // ignore
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-[#0F2942]" />
          <span>Initializing Smart Voter Search...</span>
        </div>
      </div>
    );
  }

  if (!authToken || !user) {
    return (
      <AuthGate
        needsSetup={needsSetup}
        accessCodeConfigured={accessCodeConfigured}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        user={user}
        activeTab={activeTab}
        hasDataset={Boolean(dataset)}
        onSelectTab={setActiveTab}
        onOpenOfficerModal={() => setOfficerModalOpen(true)}
        onPurgeSession={handlePurgeSession}
        onSignOut={handleSignOut}
      />

      {toastMsg && (
        <div className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-8">
        {activeTab === 'search' && (
          <SearchWorkspace
            authToken={authToken}
            dataset={dataset}
            initialQuery={presetQuery}
            initialScope={presetScope}
            initialPollingStation={presetStation}
            onUploadSuccess={handleUploadSuccess}
            onPurgeSession={handlePurgeSession}
            onSelectVoter={handleOpenVoterDetails}
            onGoToUpload={() => setActiveTab('upload')}
            onSearchExecuted={() => void refreshDashboardAndHistory(authToken)}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            dataset={dataset}
            recentVoters={recentVoters}
            onGoToUpload={() => setActiveTab('upload')}
            onSelectVoter={(v) => void handleOpenVoterDetails(v.id)}
            onFilterByPollingStation={(station) => {
              setPresetQuery('');
              setPresetScope('all');
              setPresetStation(station);
              setActiveTab('search');
            }}
          />
        )}

        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                Excel Voter List Upload
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Import, replace, or purge electoral roll workbooks (.xlsx / .xls) within your
                protected session.
              </p>
            </div>
            <FileUploadPanel
              authToken={authToken}
              dataset={dataset}
              onUploadSuccess={handleUploadSuccess}
              onPurgeSession={handlePurgeSession}
              onGoToSearch={() => setActiveTab('search')}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryView
            searchHistory={searchHistory}
            recentVoters={recentVoters}
            onRunSearch={(q, s) => {
              setPresetQuery(q);
              setPresetScope((s as SearchScope) || 'all');
              setPresetStation('all');
              setActiveTab('search');
            }}
            onSelectVoter={(v) => void handleOpenVoterDetails(v.id)}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-4 text-xs text-slate-500">
          <span>Smart Voter Search · Authorized Electoral Roll Console</span>
          <span>Session-scoped processing · No external AI sharing · No bulk export</span>
        </div>
      </footer>

      <VoterDetailModal
        voter={selectedVoter}
        fileName={dataset?.fileName || 'voter_list.xlsx'}
        officerName={user.displayName}
        onClose={() => setSelectedVoter(null)}
      />

      <OfficerManagementModal
        isOpen={officerModalOpen}
        authToken={authToken}
        currentUserId={user.id}
        onClose={() => setOfficerModalOpen(false)}
      />
    </div>
  );
}
