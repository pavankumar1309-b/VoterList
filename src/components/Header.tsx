import React from 'react';
import { Trash2, UploadCloud } from 'lucide-react';
import type { ActiveTab } from '../types.ts';

interface HeaderProps {
  activeTab: ActiveTab;
  hasDataset: boolean;
  onSelectTab: (tab: ActiveTab) => void;
  onPurgeSession: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  hasDataset,
  onSelectTab,
  onPurgeSession,
}) => {
  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'search', label: 'Search' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'upload', label: 'Upload' },
    { id: 'history', label: 'History' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="h-0.5 w-full bg-gradient-to-r from-[#0F2942] via-[#D97706] to-[#0F2942]" />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 h-16">
        {/* Zone 1: Brand Title */}
        <button
          type="button"
          onClick={() => onSelectTab('search')}
          className="font-display text-lg font-bold tracking-tight text-[#0F2942] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2942] rounded"
        >
          Smart Voter Search
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2942] rounded ${
                  isActive
                    ? 'text-[#0F2942] font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-[17px] h-0.5 bg-[#D97706]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="shrink-0">
          {hasDataset ? (
            <button
              type="button"
              onClick={onPurgeSession}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2942]"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-600 shrink-0" />
              <span>Clear Session Data</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelectTab('upload')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#173B5E] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2942]"
            >
              <UploadCloud className="h-3.5 w-3.5 shrink-0" />
              <span>Upload Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav Row */}
      <nav
        className="flex md:hidden items-center justify-around border-t border-slate-100 bg-white px-2 py-1"
        aria-label="Mobile Navigation"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 rounded-md transition-colors ${
                isActive
                  ? 'text-[#0F2942] font-semibold bg-slate-100'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
