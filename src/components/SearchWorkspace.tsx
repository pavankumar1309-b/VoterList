import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type {
  DatasetSummary,
  PublicVoterRecord,
  SearchResponse,
  SearchScope,
  SortOption,
} from '../types.ts';
import { FileUploadPanel } from './FileUploadPanel.tsx';

interface SearchWorkspaceProps {
  sessionId: string;
  dataset: DatasetSummary | null;
  initialQuery?: string;
  initialScope?: SearchScope;
  initialPollingStation?: string;
  onUploadSuccess: (summary: DatasetSummary) => void;
  onPurgeSession: () => void;
  onSelectVoter: (voterId: string) => void;
  onGoToUpload: () => void;
  onSearchExecuted: () => void;
}

export const SearchWorkspace: React.FC<SearchWorkspaceProps> = ({
  sessionId,
  dataset,
  initialQuery = '',
  initialScope = 'direct',
  initialPollingStation = 'all',
  onUploadSuccess,
  onPurgeSession,
  onSelectVoter,
  onGoToUpload,
  onSearchExecuted,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [scope, setScope] = useState<SearchScope>(initialScope);
  const [sheet, setSheet] = useState<string>('all');
  const [gender, setGender] = useState<'all' | 'male' | 'female' | 'other'>('all');
  const [pollingStation, setPollingStation] = useState<string>(initialPollingStation);
  const [minAge, setMinAge] = useState<string>('');
  const [maxAge, setMaxAge] = useState<string>('');
  const [sort, setSort] = useState<SortOption>('relevance');
  const [page, setPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const [resultsData, setResultsData] = useState<SearchResponse | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Instant suggestions state
  const [suggestions, setSuggestions] = useState<PublicVoterRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Sync external navigation triggers (from History or Dashboard polling station click)
  useEffect(() => {
    setQuery(initialQuery);
    setSubmittedQuery(initialQuery);
    setScope(initialScope);
    setPollingStation(initialPollingStation);
    setPage(1);
    if (initialPollingStation !== 'all') {
      setShowFilters(true);
    }
  }, [initialQuery, initialScope, initialPollingStation]);

  // Close suggestions dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced live suggestions while typing
  useEffect(() => {
    if (!dataset) {
      setSuggestions([]);
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed, sheet, scope });
        const res = await fetch(`/api/voters/suggest?${params.toString()}`, {
          headers: { 'X-Session-Id': sessionId },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: PublicVoterRecord[] };
        setSuggestions(data.suggestions || []);
        setActiveSuggestionIdx(-1);
      } catch {
        // Ignore transient suggestion failures
      }
    }, 160);

    return () => clearTimeout(timer);
  }, [query, sheet, scope, dataset, sessionId]);

  const executeSearch = useCallback(
    async (recordHistory: boolean) => {
      if (!dataset) return;
      setLoadingResults(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({
          q: submittedQuery,
          scope,
          sheet,
          gender,
          pollingStation,
          sort,
          page: String(page),
          pageSize: '24',
        });
        if (minAge.trim()) params.set('minAge', minAge.trim());
        if (maxAge.trim()) params.set('maxAge', maxAge.trim());
        if (recordHistory && submittedQuery.trim().length > 0) {
          params.set('recordHistory', '1');
        }

        const res = await fetch(`/api/voters/search?${params.toString()}`, {
          headers: { 'X-Session-Id': sessionId },
        });
        const data = (await res.json()) as SearchResponse & { error?: string };
        if (!res.ok) {
          setSearchError(data.error || 'Failed to search voter records.');
          return;
        }
        setResultsData(data);
        if (recordHistory) {
          onSearchExecuted();
        }
      } catch {
        setSearchError('Network error while searching voter records.');
      } finally {
        setLoadingResults(false);
      }
    },
    [
      dataset,
      submittedQuery,
      scope,
      sheet,
      gender,
      pollingStation,
      minAge,
      maxAge,
      sort,
      page,
      sessionId,
      onSearchExecuted,
    ]
  );

  // Trigger search whenever query submission or filters/pagination change
  const recordNextHistoryRef = useRef(false);
  useEffect(() => {
    if (!dataset) {
      setResultsData(null);
      return;
    }
    const shouldRecord = recordNextHistoryRef.current;
    recordNextHistoryRef.current = false;
    void executeSearch(shouldRecord);
  }, [dataset, executeSearch]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    recordNextHistoryRef.current = true;
    setPage(1);
    setSubmittedQuery(query);
  };

  const handleClearInput = () => {
    setQuery('');
    setSubmittedQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setPage(1);
  };

  const handleResetAll = () => {
    setQuery('');
    setSubmittedQuery('');
    setScope('direct');
    setSheet('all');
    setGender('all');
    setPollingStation('all');
    setMinAge('');
    setMaxAge('');
    setSort('relevance');
    setPage(1);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIdx((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeSuggestionIdx >= 0) {
      e.preventDefault();
      const chosen = suggestions[activeSuggestionIdx];
      setShowSuggestions(false);
      onSelectVoter(chosen.id);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Initial Empty State before any Excel file is uploaded
  if (!dataset) {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-wide text-[#B45309]">
              Electoral Roll Lookup
            </p>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#0F2942] text-balance">
              Search Large Voter Lists Instantly from Excel
            </h1>
            <p className="mt-3 text-base text-slate-600 leading-relaxed max-w-2xl">
              Upload any electoral roll workbook (.xlsx or .xls) to inspect voter details by full
              name, partial name, EPIC / Voter ID, house number, or relative name. Columns and
              worksheets are detected automatically.
            </p>
          </div>
        </div>

        <FileUploadPanel
          sessionId={sessionId}
          dataset={null}
          compact
          onUploadSuccess={onUploadSuccess}
          onPurgeSession={onPurgeSession}
        />
      </div>
    );
  }

  const activeFiltersCount =
    (sheet !== 'all' ? 1 : 0) +
    (gender !== 'all' ? 1 : 0) +
    (pollingStation !== 'all' ? 1 : 0) +
    (minAge.trim() ? 1 : 0) +
    (maxAge.trim() ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Prominent Search Banner */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F2942]">
              Voter Information Search
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Active Workbook: <span className="font-medium text-slate-700">{dataset.fileName}</span>{' '}
              · <span className="font-mono tabular-nums">{dataset.stats.totalVoters.toLocaleString()}</span>{' '}
              voters imported
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToUpload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#0F2942]" />
            <span>Replace Excel File</span>
          </button>
        </div>

        {/* Search Form + Live Suggestions */}
        <form onSubmit={handleFormSubmit} className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1" ref={searchBoxRef}>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by Voter Name, EPIC / Voter ID, House Number, or Relative Name..."
                aria-label="Search voters"
                className="w-full rounded-lg border border-slate-300 bg-white pl-11 pr-10 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0F2942] focus:outline-none focus:ring-2 focus:ring-[#0F2942]/15"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearInput}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Live Search Suggestions Dropdown */}
              {showSuggestions && query.trim().length >= 2 && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-[11px] font-semibold text-slate-500">
                    Instant Matches (select to open record)
                  </div>
                  <ul role="listbox" className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {suggestions.map((item, idx) => {
                      const sName =
                        item.summary.name ||
                        Object.values(item.fields).find((v) => v && v.trim().length > 0) ||
                        `Row #${item.excelRowNumber}`;
                      const isSelected = idx === activeSuggestionIdx;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowSuggestions(false);
                              onSelectVoter(item.id);
                            }}
                            className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors ${
                              isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{sName}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {[
                                  item.summary.relativeName
                                    ? `Rel: ${item.summary.relativeName}`
                                    : null,
                                  item.summary.houseNumber
                                    ? `House: ${item.summary.houseNumber}`
                                    : null,
                                  item.summary.pollingStation,
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || `${item.sheetName} · Row #${item.excelRowNumber}`}
                              </p>
                            </div>
                            {item.summary.voterId && (
                              <span className="font-mono text-xs font-medium text-[#B45309] shrink-0 tabular-nums">
                                {item.summary.voterId}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as SearchScope);
                setPage(1);
              }}
              aria-label="Search field scope"
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-700 focus:border-[#0F2942] focus:outline-none"
            >
              <option value="direct">Direct Voter Search (Name / ID / House)</option>
              <option value="name">Voter Name Only</option>
              <option value="voterId">EPIC / Voter ID Only</option>
              <option value="houseNumber">House Number Only</option>
              <option value="relativeName">Relative Name Only</option>
              <option value="all">All Columns (Include Relative)</option>
            </select>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F2942] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#173B5E] whitespace-nowrap shrink-0"
            >
              <Search className="h-4 w-4" />
              <span>Search</span>
            </button>
          </div>

          {/* Worksheet Tabs & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              {dataset.sheets.length > 1 && (
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSheet('all');
                      setPage(1);
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      sheet === 'all'
                        ? 'bg-white text-[#0F2942] shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Sheets
                  </button>
                  {dataset.sheets.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => {
                        setSheet(s.name);
                        setPage(1);
                      }}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        sheet === s.name
                          ? 'bg-white text-[#0F2942] shadow-sm font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {s.name} ({s.rowCount.toLocaleString()})
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  showFilters || activeFiltersCount > 0
                    ? 'border-[#0F2942] bg-[#0F2942]/5 text-[#0F2942]'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>
                  Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
                </span>
              </button>

              {(submittedQuery.length > 0 || activeFiltersCount > 0 || sort !== 'relevance') && (
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Search</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as SortOption);
                  setPage(1);
                }}
                aria-label="Sort results"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#0F2942] focus:outline-none"
              >
                <option value="relevance">Sort: Relevance</option>
                <option value="name_asc">Name (A to Z)</option>
                <option value="name_desc">Name (Z to A)</option>
                {dataset.stats.hasAgeData && <option value="age_asc">Age (Low to High)</option>}
                {dataset.stats.hasAgeData && <option value="age_desc">Age (High to Low)</option>}
                <option value="serial_asc">Serial Number</option>
                <option value="row_asc">Excel Row Order</option>
              </select>

              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  aria-label="Card view"
                  className={`rounded-md p-1.5 transition-colors ${
                    viewMode === 'cards' ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  aria-label="Table view"
                  className={`rounded-md p-1.5 transition-colors ${
                    viewMode === 'table' ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Expandable Filters Panel */}
          {showFilters && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              {dataset.stats.hasGenderData && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => {
                      setGender(e.target.value as 'all' | 'male' | 'female' | 'other');
                      setPage(1);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0F2942] focus:outline-none"
                  >
                    <option value="all">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}

              {dataset.stats.hasPollingStationData && dataset.stats.pollingStations.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Polling Station
                  </label>
                  <select
                    value={pollingStation}
                    onChange={(e) => {
                      setPollingStation(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0F2942] focus:outline-none"
                  >
                    <option value="all">All Polling Stations</option>
                    {dataset.stats.pollingStations.map((ps) => (
                      <option key={ps.name} value={ps.name}>
                        {ps.name} ({ps.count})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {dataset.stats.hasAgeData && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Min Age
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={130}
                    placeholder="e.g. 18"
                    value={minAge}
                    onChange={(e) => {
                      setMinAge(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0F2942] focus:outline-none"
                  />
                </div>
              )}

              {dataset.stats.hasAgeData && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Max Age
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={130}
                    placeholder="e.g. 60"
                    value={maxAge}
                    onChange={(e) => {
                      setMaxAge(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0F2942] focus:outline-none"
                  />
                </div>
              )}

              {!dataset.stats.hasGenderData &&
                !dataset.stats.hasPollingStationData &&
                !dataset.stats.hasAgeData && (
                  <p className="col-span-full text-xs text-slate-500">
                    No Gender, Polling Station, or Age columns were detected in this Excel file for
                    attribute filtering.
                  </p>
                )}
            </div>
          )}
        </form>
      </section>

      {/* Error Message */}
      {searchError && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Results Header */}
      {resultsData && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-sm text-slate-600 tabular-nums">
            {resultsData.totalMatches === 0 ? (
              '0 matching voters'
            ) : (
              <>
                Showing{' '}
                <span className="font-semibold text-slate-900">
                  {((resultsData.page - 1) * resultsData.pageSize + 1).toLocaleString()}–
                  {Math.min(
                    resultsData.page * resultsData.pageSize,
                    resultsData.totalMatches
                  ).toLocaleString()}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-slate-900">
                  {resultsData.totalMatches.toLocaleString()}
                </span>{' '}
                matching voter{resultsData.totalMatches === 1 ? '' : 's'}
                {submittedQuery.trim() ? ` for "${submittedQuery.trim()}"` : ''}
              </>
            )}
          </p>
          {resultsData.totalPages > 1 && (
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              Page {resultsData.page} of {resultsData.totalPages}
            </span>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {loadingResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="h-5 w-2/3 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="h-8 rounded bg-slate-100" />
                <div className="h-8 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty Search Result State */}
      {!loadingResults && resultsData && resultsData.results.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Search className="h-5 w-5" />
          </div>
          <p className="font-display text-base font-semibold text-slate-900">
            No voter found. Please check the name or try another search.
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            Verify spelling, try searching by partial name or EPIC / Voter ID, or clear active
            filters.
          </p>
          <button
            type="button"
            onClick={handleResetAll}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Search &amp; Filters</span>
          </button>
        </div>
      )}

      {/* Results: Card Grid */}
      {!loadingResults && resultsData && resultsData.results.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resultsData.results.map((voter) => {
            const displayName =
              voter.summary.name ||
              Object.values(voter.fields).find((v) => v && v.trim().length > 0) ||
              `Record #${voter.excelRowNumber}`;

            return (
              <article
                key={voter.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-[#0F2942]/40"
              >
                <div>
                  <p className="text-xs text-slate-500 truncate">
                    {voter.sheetName} · Row #{voter.excelRowNumber}
                    {voter.summary.serialNumber ? ` · Serial ${voter.summary.serialNumber}` : ''}
                  </p>
                  <h3 className="mt-1 font-display text-base font-bold text-slate-900 truncate">
                    {displayName}
                  </h3>

                  {voter.summary.relativeName && (
                    <p className="mt-0.5 text-xs text-slate-600 truncate">
                      Relative: {voter.summary.relativeName}
                    </p>
                  )}

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-slate-100 pt-3.5 text-xs">
                    <div>
                      <dt className="text-slate-500">Voter ID</dt>
                      <dd className="mt-0.5 font-mono font-semibold text-[#0F2942] tabular-nums truncate">
                        {voter.summary.voterId || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">House Number</dt>
                      <dd className="mt-0.5 font-mono font-medium text-slate-800 tabular-nums truncate">
                        {voter.summary.houseNumber || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Age</dt>
                      <dd className="mt-0.5 font-mono font-medium text-slate-800 tabular-nums">
                        {voter.summary.age || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Gender</dt>
                      <dd className="mt-0.5 font-medium text-slate-800 truncate">
                        {voter.summary.gender || '—'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
                  <span className="text-xs text-slate-500 truncate">
                    {voter.summary.pollingStation || `${voter.headers.length} fields`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectVoter(voter.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2942] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#173B5E] whitespace-nowrap shrink-0"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View Full Details</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Results: Table View */}
      {!loadingResults && resultsData && resultsData.results.length > 0 && viewMode === 'table' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Voter Name</th>
                <th className="px-4 py-3">Voter ID</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3">House No.</th>
                <th className="px-4 py-3">Relative / Station</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resultsData.results.map((voter) => {
                const displayName =
                  voter.summary.name ||
                  Object.values(voter.fields).find((v) => v && v.trim().length > 0) ||
                  `Row #${voter.excelRowNumber}`;
                return (
                  <tr key={voter.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div>{displayName}</div>
                      <div className="text-xs font-normal text-slate-500">
                        {voter.sheetName} · Row #{voter.excelRowNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-[#0F2942] tabular-nums whitespace-nowrap">
                      {voter.summary.voterId || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums">
                      {voter.summary.age || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {voter.summary.gender || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums">
                      {voter.summary.houseNumber || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px] truncate">
                      {voter.summary.relativeName || voter.summary.pollingStation || '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectVoter(voter.id)}
                        className="rounded-lg bg-[#0F2942] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#173B5E]"
                      >
                        View Full Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loadingResults && resultsData && resultsData.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3.5">
          <button
            type="button"
            disabled={resultsData.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <span className="font-mono text-xs text-slate-600 tabular-nums">
            Page {resultsData.page} of {resultsData.totalPages}
          </span>

          <button
            type="button"
            disabled={resultsData.page >= resultsData.totalPages}
            onClick={() => setPage((p) => Math.min(resultsData.totalPages, p + 1))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
