import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, FileSpreadsheet, X } from 'lucide-react';
import type { PublicVoterRecord } from '../types.ts';
import { downloadVoterPdf } from '../utils/pdfExport.ts';

interface VoterDetailModalProps {
  voter: PublicVoterRecord | null;
  fileName: string;
  onClose: () => void;
}

export const VoterDetailModal: React.FC<VoterDetailModalProps> = ({
  voter,
  fileName,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!voter) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [voter, onClose]);

  if (!voter) return null;

  const primaryName =
    voter.summary.name ||
    Object.values(voter.fields).find((v) => v && v.trim().length > 0) ||
    `Record #${voter.excelRowNumber}`;

  const handleCopyId = async () => {
    if (!voter.summary.voterId) return;
    try {
      await navigator.clipboard.writeText(voter.summary.voterId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  const quickFields: Array<{ label: string; value?: string; mono?: boolean }> = [
    { label: 'EPIC / Voter ID', value: voter.summary.voterId, mono: true },
    { label: "Father's / Husband's / Relative Name", value: voter.summary.relativeName },
    { label: "Mother's Name", value: voter.summary.motherName },
    { label: 'Age', value: voter.summary.age, mono: true },
    { label: 'Gender', value: voter.summary.gender },
    { label: 'House Number', value: voter.summary.houseNumber, mono: true },
    { label: 'Polling Station', value: voter.summary.pollingStation },
    { label: 'Part Number', value: voter.summary.partNumber, mono: true },
    { label: 'Serial Number', value: voter.summary.serialNumber, mono: true },
    { label: 'Assembly Constituency', value: voter.summary.constituency },
    { label: 'District', value: voter.summary.district },
    { label: 'Address', value: voter.summary.address },
  ].filter((f) => Boolean(f.value && f.value.trim().length > 0));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="voter-detail-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Navy Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#0F2942] px-6 py-5 text-white">
          <div className="min-w-0">
            <p className="text-xs font-medium text-amber-300">
              Worksheet: {voter.sheetName} · Excel Row #{voter.excelRowNumber}
            </p>
            <h2
              id="voter-detail-title"
              className="mt-1 font-display text-xl font-bold tracking-tight text-white truncate"
            >
              {primaryName}
            </h2>
            {voter.summary.voterId && (
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-sm text-slate-200 tabular-nums">
                  EPIC / Voter ID: {voter.summary.voterId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-slate-200 hover:bg-white/10 transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close voter details"
            className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {quickFields.length > 0 && (
            <section>
              <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                Identified Voter Profile
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                {quickFields.map((field) => (
                  <div key={field.label} className="min-w-0">
                    <dt className="text-xs font-medium text-slate-500">{field.label}</dt>
                    <dd
                      className={`mt-0.5 text-sm font-medium text-slate-900 break-words ${
                        field.mono ? 'font-mono tabular-nums' : ''
                      }`}
                    >
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Complete Original Excel Row Table */}
          <section>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-[#0F2942]" />
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Original Excel Row Information
                </h3>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {voter.headers.length} columns
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="w-2/5 px-4 py-2.5">Excel Column Header</th>
                    <th className="w-3/5 px-4 py-2.5">Exact Recorded Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {voter.headers.map((header) => {
                    const rawVal = voter.fields[header];
                    return (
                      <tr key={header} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2.5 text-xs font-medium text-slate-600 align-top">
                          {header}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-900 break-words align-top">
                          {rawVal && rawVal.trim().length > 0 ? (
                            rawVal
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <p className="text-xs text-slate-500">
            Single-record extract from the uploaded electoral roll.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => downloadVoterPdf(voter, fileName)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#173B5E] whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Voter PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
