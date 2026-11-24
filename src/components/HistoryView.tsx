import React from 'react';
import { Clock, Eye, Search, Trash2 } from 'lucide-react';
import type { PublicVoterRecord, RecentSearchEntry } from '../types.ts';

interface HistoryViewProps {
  searchHistory: RecentSearchEntry[];
  recentVoters: PublicVoterRecord[];
  onRunSearch: (query: string, scope: string) => void;
  onSelectVoter: (voter: PublicVoterRecord) => void;
  onClearHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  searchHistory,
  recentVoters,
  onRunSearch,
  onSelectVoter,
  onClearHistory,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Session Search History
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Private to your active authenticated session. Cleared automatically when you sign out
            or delete uploaded data.
          </p>
        </div>

        {(searchHistory.length > 0 || recentVoters.length > 0) && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Queries */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#0F2942]" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Recent Search Queries
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {searchHistory.length}
            </span>
          </div>

          {searchHistory.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No searches recorded in this session yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {searchHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onRunSearch(item.query, item.scope)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-3.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Search className="h-4 w-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{item.query}</p>
                      <p className="text-xs text-slate-500">
                        Scope: {item.scope} · {new Date(item.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-slate-600 tabular-nums shrink-0">
                    {item.resultCount.toLocaleString()} matches
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Recently Viewed Voters */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-[#D97706]" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Recently Inspected Voters
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {recentVoters.length}
            </span>
          </div>

          {recentVoters.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No individual voter records viewed in this session yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentVoters.map((voter) => {
                const name =
                  voter.summary.name ||
                  Object.values(voter.fields).find((v) => v && v.trim().length > 0) ||
                  `Row #${voter.excelRowNumber}`;
                return (
                  <button
                    key={voter.id}
                    type="button"
                    onClick={() => onSelectVoter(voter)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-3.5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {[
                          voter.summary.voterId,
                          voter.summary.relativeName,
                          voter.summary.houseNumber ? `House ${voter.summary.houseNumber}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || `${voter.sheetName} · Row #${voter.excelRowNumber}`}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#0F2942] whitespace-nowrap shrink-0">
                      View Details
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
