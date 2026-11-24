import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Shield, Trash2, Users } from 'lucide-react';
import type { ActiveTab, AuthUser } from '../types.ts';

interface HeaderProps {
  user: AuthUser;
  activeTab: ActiveTab;
  hasDataset: boolean;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenOfficerModal: () => void;
  onPurgeSession: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  hasDataset,
  onSelectTab,
  onOpenOfficerModal,
  onPurgeSession,
  onSignOut,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        {/* Zone 1: Brand Title (single line) */}
        <button
          type="button"
          onClick={() => onSelectTab('search')}
          className="font-display text-lg font-bold tracking-tight text-[#0F2942] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2942] rounded"
        >
          Smart Voter Search
        </button>

        {/* Zone 2: Primary Navigation Links (single-line typography with subtle active underline) */}
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

        {/* Zone 3: Single Primary Officer Action */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-[#0F2942] transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2942]"
          >
            <Shield className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="max-w-[140px] truncate">{user.displayName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg z-50">
              <div className="border-b border-slate-100 px-4 py-2.5">
                <p className="text-xs font-semibold text-slate-900 truncate">{user.displayName}</p>
                <p className="text-xs text-slate-500 truncate">
                  {user.username} · {user.role === 'admin' ? 'Administrator' : 'Officer'}
                </p>
              </div>

              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenOfficerModal();
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Users className="h-4 w-4 text-slate-500" />
                  <span>Manage Officers</span>
                </button>
              )}

              {hasDataset && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onPurgeSession();
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-amber-800 hover:bg-amber-50"
                >
                  <Trash2 className="h-4 w-4 text-amber-700" />
                  <span>Delete Uploaded Data</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut();
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 text-red-600" />
                <span>Sign Out &amp; Clear Session</span>
              </button>
            </div>
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
