import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { DashboardView } from './components/DashboardView.tsx';
import { FileUploadPanel } from './components/FileUploadPanel.tsx';
import { Header } from './components/Header.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { SearchWorkspace } from './components/SearchWorkspace.tsx';
import { VoterDetailModal } from './components/VoterDetailModal.tsx';
import type {
  ActiveTab,
  DatasetSummary,
  PublicVoterRecord,
  RecentSearchEntry,
  SearchScope,
} from './types.ts';

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function App() {
  const [sessionId, setSessionId] = useState<string>(() => createSessionId());
  const [activeTab, setActiveTab] = useState<ActiveTab>('search');
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [recentVoters, setRecentVoters] = useState<PublicVoterRecord[]>([]);
  const [searchHistory, setSearchHistory] = useState<RecentSearchEntry[]>([]);
  const [selectedVoter, setSelectedVoter] = useState<PublicVoterRecord | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Cross-tab search presets
  const [presetQuery, setPresetQuery] = useState('');
  const [presetScope, setPresetScope] = useState<SearchScope>('direct');
  const [presetStation, setPresetStation] = useState('all');

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const refreshDashboardAndHistory = useCallback(async (sid: string) => {
    try {
      const [dashRes, histRes] = await Promise.all([
        fetch('/api/dashboard', { headers: { 'X-Session-Id': sid } }),
        fetch('/api/history', { headers: { 'X-Session-Id': sid } }),
      ]);

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

  useEffect(() => {
    void refreshDashboardAndHistory(sessionId);
  }, [sessionId, refreshDashboardAndHistory]);

  const handleUploadSuccess = (summary: DatasetSummary) => {
    setDataset(summary);
    setRecentVoters([]);
    setSearchHistory([]);
    setPresetQuery('');
    setPresetScope('direct');
    setPresetStation('all');
  };

  const handleOpenVoterDetails = async (voterId: string) => {
    try {
      const res = await fetch(`/api/voters/${encodeURIComponent(voterId)}`, {
        headers: { 'X-Session-Id': sessionId },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { voter: PublicVoterRecord };
      setSelectedVoter(data.voter);
      void refreshDashboardAndHistory(sessionId);
    } catch {
      // ignore
    }
  };

  const handlePurgeSession = async () => {
    try {
      await fetch('/api/session/purge', {
        method: 'POST',
        headers: { 'X-Session-Id': sessionId },
      });
    } catch {
      // ignore
    }
    setDataset(null);
    setRecentVoters([]);
    setSearchHistory([]);
    setSelectedVoter(null);
    setPresetQuery('');
    setPresetScope('direct');
    setPresetStation('all');
    setSessionId(createSessionId());
    showToast('Uploaded voter data and session history cleared.');
  };

  const handleClearHistory = async () => {
    try {
      await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'X-Session-Id': sessionId },
      });
      setSearchHistory([]);
      setRecentVoters([]);
      showToast('Search history cleared.');
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        activeTab={activeTab}
        hasDataset={Boolean(dataset)}
        onSelectTab={setActiveTab}
        onPurgeSession={handlePurgeSession}
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
            sessionId={sessionId}
            dataset={dataset}
            initialQuery={presetQuery}
            initialScope={presetScope}
            initialPollingStation={presetStation}
            onUploadSuccess={handleUploadSuccess}
            onPurgeSession={handlePurgeSession}
            onSelectVoter={handleOpenVoterDetails}
            onGoToUpload={() => setActiveTab('upload')}
            onSearchExecuted={() => void refreshDashboardAndHistory(sessionId)}
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
              setPresetScope('direct');
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
                Import, replace, or clear electoral roll workbooks (.xlsx / .xls) within your
                active browser session.
              </p>
            </div>
            <FileUploadPanel
              sessionId={sessionId}
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
              setPresetScope((s as SearchScope) || 'direct');
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
          <span>Smart Voter Search · Electoral Roll Lookup System</span>
          <span>Session-scoped processing · No external AI sharing · No bulk export</span>
        </div>
      </footer>

      <VoterDetailModal
        voter={selectedVoter}
        fileName={dataset?.fileName || 'voter_list.xlsx'}
        onClose={() => setSelectedVoter(null)}
      />
    </div>
  );
}
