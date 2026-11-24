import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { DatasetSummary } from '../types.ts';

interface FileUploadPanelProps {
  authToken: string;
  dataset: DatasetSummary | null;
  compact?: boolean;
  onUploadSuccess: (summary: DatasetSummary) => void;
  onPurgeSession: () => void;
  onGoToSearch?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const FileUploadPanel: React.FC<FileUploadPanelProps> = ({
  authToken,
  dataset,
  compact = false,
  onUploadSuccess,
  onPurgeSession,
  onGoToSearch,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const processFile = async (file: File) => {
    setError(null);
    setSuccessMsg(null);

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      setError('Unsupported file type. Please choose an Excel workbook (.xlsx or .xls).');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      const data = (await res.json()) as DatasetSummary & { error?: string };
      if (!res.ok) {
        setError(data.error || 'Failed to process the uploaded Excel file.');
        return;
      }

      onUploadSuccess(data);
      setSuccessMsg(
        `Imported ${data.stats.totalRecordsImported.toLocaleString()} voter records across ${data.sheets.length} worksheet${data.sheets.length === 1 ? '' : 's'} from "${data.fileName}".`
      );
    } catch {
      setError('Network error while uploading the Excel file. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold">Excel Upload Failed</p>
            <p className="mt-0.5 text-red-800">{error}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="font-semibold">Electoral Roll Imported Successfully</p>
              <p className="mt-0.5 text-emerald-900">{successMsg}</p>
            </div>
          </div>
          {onGoToSearch && (
            <button
              type="button"
              onClick={onGoToSearch}
              className="rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#173B5E] whitespace-nowrap shrink-0"
            >
              Search Voter List
            </button>
          )}
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed bg-white transition-colors ${
          dragActive
            ? 'border-[#D97706] bg-amber-50/40'
            : 'border-slate-300 hover:border-[#0F2942]/50'
        } ${compact ? 'p-6 sm:p-8' : 'p-8 sm:p-12'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={handleFileChange}
          className="sr-only"
          id="excel-file-input"
          disabled={uploading}
        />

        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-[#0F2942]">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-[#D97706]" />
            ) : (
              <UploadCloud className="h-6 w-6 text-[#0F2942]" />
            )}
          </div>

          <h3 className="font-display text-lg font-semibold text-slate-900">
            {uploading
              ? 'Processing Electoral Roll Workbook...'
              : dataset
              ? 'Replace Active Voter List Workbook'
              : 'Upload Voter List Excel File'}
          </h3>

          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {uploading
              ? 'Reading worksheets, detecting headers, and building an instant search index in your protected session.'
              : 'Drag and drop an Excel workbook (.xlsx or .xls, up to 25 MB) here, or select a file from your computer. All worksheets and columns are detected automatically.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F2942] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#173B5E] disabled:opacity-60 whitespace-nowrap"
            >
              {dataset ? <RefreshCw className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
              <span>
                {uploading
                  ? 'Importing Records...'
                  : dataset
                  ? 'Choose Replacement File'
                  : 'Select Excel File (.xlsx / .xls)'}
              </span>
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Original cell values are preserved intact · Supports thousands of records &amp; multiple worksheets
          </p>
        </div>
      </div>

      {/* Active Dataset Summary */}
      {dataset && !compact && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div>
              <h4 className="font-display text-base font-semibold text-slate-900">
                Active Session Workbook
              </h4>
              <p className="mt-0.5 text-xs text-slate-500">
                {dataset.fileName} · {formatBytes(dataset.fileSizeBytes)} · Imported{' '}
                {new Date(dataset.uploadedAt).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {confirmPurge ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmPurge(false);
                      setSuccessMsg(null);
                      onPurgeSession();
                    }}
                    className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 whitespace-nowrap"
                  >
                    Confirm Delete Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmPurge(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmPurge(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Uploaded Data</span>
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {dataset.sheets.map((sheet) => (
              <div key={sheet.name} className="px-6 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FileSpreadsheet className="h-4 w-4 text-[#0F2942]" />
                    <span>{sheet.name}</span>
                  </div>
                  <span className="font-mono text-xs text-slate-600 tabular-nums">
                    {sheet.rowCount.toLocaleString()} records · Header Row {sheet.headerRowNumber} ·{' '}
                    {sheet.headers.length} columns
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Detected Columns:{' '}
                  <span className="text-slate-800">{sheet.headers.join(' · ')}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
