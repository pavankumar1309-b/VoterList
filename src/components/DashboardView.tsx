import React from 'react';
import { BarChart3, Building2, Eye, FileSpreadsheet, UploadCloud, Users } from 'lucide-react';
import type { DatasetSummary, PublicVoterRecord } from '../types.ts';

interface DashboardViewProps {
  dataset: DatasetSummary | null;
  recentVoters: PublicVoterRecord[];
  onGoToUpload: () => void;
  onSelectVoter: (voter: PublicVoterRecord) => void;
  onFilterByPollingStation: (stationName: string) => void;
}

function pct(count: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  dataset,
  recentVoters,
  onGoToUpload,
  onSelectVoter,
  onFilterByPollingStation,
}) => {
  if (!dataset) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-[#0F2942]">
          <BarChart3 className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-semibold text-slate-900">
          No Voter Roll Dataset Loaded
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Upload an Excel voter list (.xlsx or .xls) to generate demographic statistics, polling
          station counts, and worksheet breakdowns.
        </p>
        <button
          type="button"
          onClick={onGoToUpload}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0F2942] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#173B5E]"
        >
          <UploadCloud className="h-4 w-4" />
          <span>Upload Voter Excel File</span>
        </button>
      </div>
    );
  }

  const { stats } = dataset;

  const kpiCards: Array<{ label: string; value: string; sub: string; available: boolean }> = [
    {
      label: 'Total Voters',
      value: stats.totalVoters.toLocaleString(),
      sub: `${stats.totalRecordsImported.toLocaleString()} records imported`,
      available: true,
    },
    {
      label: 'Male Voters',
      value: stats.hasGenderData ? stats.maleVoters.toLocaleString() : 'N/A',
      sub: stats.hasGenderData ? `${pct(stats.maleVoters, stats.totalVoters)} of total` : 'No gender column',
      available: stats.hasGenderData,
    },
    {
      label: 'Female Voters',
      value: stats.hasGenderData ? stats.femaleVoters.toLocaleString() : 'N/A',
      sub: stats.hasGenderData
        ? `${pct(stats.femaleVoters, stats.totalVoters)} of total`
        : 'No gender column',
      available: stats.hasGenderData,
    },
    {
      label: 'Other Gender Voters',
      value: stats.hasGenderData ? stats.otherGenderVoters.toLocaleString() : 'N/A',
      sub: stats.hasGenderData
        ? `${pct(stats.otherGenderVoters, stats.totalVoters)} of total`
        : 'No gender column',
      available: stats.hasGenderData,
    },
    {
      label: 'Polling Stations',
      value: stats.hasPollingStationData ? stats.totalPollingStations.toLocaleString() : 'N/A',
      sub: stats.hasPollingStationData ? 'Distinct stations detected' : 'No station column',
      available: stats.hasPollingStationData,
    },
  ];

  const maxAgeCount = Math.max(1, ...stats.ageBuckets.map((b) => b.count));

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Electoral Roll Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Source: <span className="font-medium text-slate-800">{dataset.fileName}</span> ·{' '}
            {dataset.sheets.length} worksheet{dataset.sheets.length === 1 ? '' : 's'} · Imported{' '}
            {new Date(dataset.uploadedAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToUpload}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
        >
          Replace Excel File
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <p className="text-xs font-semibold text-slate-500">{card.label}</p>
            <p
              className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
                card.available ? 'text-[#0F2942]' : 'text-slate-400'
              }`}
            >
              {card.value}
            </p>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Demographic & Age Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Breakdown */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Gender Distribution
            </h2>
            <Users className="h-4 w-4 text-slate-400" />
          </div>

          {!stats.hasGenderData ? (
            <p className="text-sm text-slate-500">
              No gender or sex column was detected in the uploaded workbook.
            </p>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Male Voters', count: stats.maleVoters, barClass: 'bg-[#0F2942]' },
                { label: 'Female Voters', count: stats.femaleVoters, barClass: 'bg-[#D97706]' },
                { label: 'Other Gender', count: stats.otherGenderVoters, barClass: 'bg-slate-600' },
                ...(stats.unspecifiedGenderVoters > 0
                  ? [
                      {
                        label: 'Unspecified / Blank',
                        count: stats.unspecifiedGenderVoters,
                        barClass: 'bg-slate-300',
                      },
                    ]
                  : []),
              ].map((row) => {
                const widthPct = stats.totalVoters
                  ? Math.round((row.count / stats.totalVoters) * 1000) / 10
                  : 0;
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-700">{row.label}</span>
                      <span className="font-mono text-slate-700 tabular-nums">
                        {row.count.toLocaleString()} ({widthPct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${row.barClass}`}
                        style={{ width: `${Math.max(widthPct, row.count > 0 ? 1.5 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Age Distribution */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Age Bracket Overview
            </h2>
            <BarChart3 className="h-4 w-4 text-slate-400" />
          </div>

          {!stats.hasAgeData ? (
            <p className="text-sm text-slate-500">
              No age column was detected in the uploaded workbook.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.ageBuckets.map((bucket) => {
                const widthPct = Math.round((bucket.count / maxAgeCount) * 100);
                return (
                  <div key={bucket.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{bucket.label}</span>
                      <span className="font-mono text-slate-700 tabular-nums">
                        {bucket.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#1E3A5F]"
                        style={{ width: `${Math.max(widthPct, bucket.count > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Polling Stations & Recently Searched Voters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Polling Stations */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#0F2942]" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Polling Stations
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {stats.hasPollingStationData ? `${stats.totalPollingStations} total` : 'Unavailable'}
            </span>
          </div>

          {!stats.hasPollingStationData || stats.pollingStations.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No polling station column was detected in the uploaded workbook.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {stats.pollingStations.slice(0, 50).map((ps) => (
                <button
                  key={ps.name}
                  type="button"
                  onClick={() => onFilterByPollingStation(ps.name)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-3 text-left text-sm hover:bg-slate-50 transition-colors"
                >
                  <span className="font-medium text-slate-800 truncate">{ps.name}</span>
                  <span className="font-mono text-xs font-semibold text-[#0F2942] tabular-nums shrink-0">
                    {ps.count.toLocaleString()} voters
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Recently Searched / Inspected Voters (Authenticated Session Only) */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-[#D97706]" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Recently Viewed Voters
              </h2>
            </div>
            <span className="text-xs text-slate-500">Current session only</span>
          </div>

          {recentVoters.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              Voters you inspect in your current authorized session will appear here for quick
              follow-up.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {recentVoters.map((v) => {
                const name =
                  v.summary.name ||
                  Object.values(v.fields).find((val) => val && val.trim().length > 0) ||
                  `Row #${v.excelRowNumber}`;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onSelectVoter(v)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {[
                          v.summary.voterId,
                          v.summary.age ? `Age ${v.summary.age}` : null,
                          v.summary.houseNumber ? `House ${v.summary.houseNumber}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || `${v.sheetName} · Row #${v.excelRowNumber}`}
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

      {/* Worksheet Breakdown Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#0F2942]" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              Worksheets &amp; Imported Columns
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {stats.sheetBreakdown.length} sheet{stats.sheetBreakdown.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-6 py-3">Worksheet Name</th>
                <th className="px-6 py-3 text-right">Records</th>
                <th className="px-6 py-3">Excel Columns Detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.sheetBreakdown.map((s) => (
                <tr key={s.name} className="hover:bg-slate-50/70">
                  <td className="px-6 py-3 font-medium text-slate-900 whitespace-nowrap">{s.name}</td>
                  <td className="px-6 py-3 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                    {s.count.toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-600">{s.headers.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
