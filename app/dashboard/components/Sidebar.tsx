import React from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import { HomeIcon, HistoryIcon, VideoIcon, SparklesIcon, SettingsIcon } from './icons';

// Simple Icons for Theme
const SunIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
);

const MoonIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);

interface SidebarProps {
    isDark: boolean;
    setIsDark: (val: boolean) => void;
    showHistory: boolean;
    setShowHistory: (val: boolean) => void;
    historyCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isDark,
    setIsDark,
    showHistory,
    setShowHistory,
    historyCount
}) => {
    return (
        <div className="h-full flex flex-col justify-between p-4 w-full bg-[var(--surface-1)] border-r border-[var(--border-subtle)]">
            {/* Top Section */}
            <div className="space-y-6">
                {/* Brand */}
                <Link href="/" className="flex items-center gap-3 px-2 py-1">
                    <div className="w-8 h-8 rounded-lg bg-[var(--brand-gradient)] flex items-center justify-center shadow-md">
                        <span className="text-white font-bold text-lg">P</span>
                    </div>
                    <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
                        Pocket
                    </span>
                </Link>

                {/* Navigation Items */}
                <div className="space-y-1">
                    <div className="px-3 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Studio</div>

                    {/* Primary Action (Generate) */}
                    <button
                        onClick={() => setShowHistory(false)} // Assume "False" history means "Editor" view
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${!showHistory
                            ? 'bg-[var(--brand-primary)] text-white shadow-md shadow-red-500/20'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'}`}
                    >
                        <SparklesIcon className="w-4 h-4" />
                        <span>Generate Video</span>
                    </button>

                    {/* My Videos (History) */}
                    <button
                        onClick={() => setShowHistory(true)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${showHistory
                            ? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'}`}
                    >
                        <div className="flex items-center gap-3">
                            <VideoIcon className="w-4 h-4" />
                            <span>My Videos</span>
                        </div>
                        {historyCount > 0 && (
                            <span className="text-[10px] font-bold opacity-60">
                                {historyCount}
                            </span>
                        )}
                    </button>

                    <div className="px-3 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mt-6 mb-2">Account</div>

                    <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-all text-sm font-medium">
                        <SettingsIcon className="w-4 h-4" />
                        <span>Billing</span>
                    </button>
                </div>
            </div>

            {/* Bottom Section (Credits & Profile) */}
            <div className="space-y-4 relative">
                {/* Visual Credits Card (Tolo Style) */}
                <div className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--border-subtle)] relative overflow-hidden group">
                    {/* Decorative background element */}
                    <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--brand-primary)]/5 rounded-full -mr-8 -mt-8"></div>

                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">⚡️</span>
                        <span className="text-xs font-bold text-[var(--text-primary)]">Pro Plan</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden mb-2">
                        <div className="h-full w-[70%] bg-[#22c55e] rounded-full"></div>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)]">137 credits remaining</p>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)] relative">
                    <UserMenu />

                    <button
                        onClick={() => setIsDark(!isDark)}
                        className="p-2 rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-colors"
                        title="Toggle Theme"
                    >
                        {isDark ? <SunIcon /> : <MoonIcon />}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Internal User Menu Component
const UserMenu = () => {
    const { user } = useUser();
    const { signOut, openUserProfile } = useClerk();
    const [isOpen, setIsOpen] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    // Close on click outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 hover:bg-[var(--surface-3)] p-1.5 -ml-1.5 rounded-lg transition-colors text-left"
            >
                <div className="w-8 h-8 rounded-full bg-[var(--surface-3)] flex items-center justify-center overflow-hidden border border-[var(--border-subtle)]">
                    <img src={user?.imageUrl} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[80px]">
                        {user?.firstName || 'My Account'}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">Free Plan</span>
                </div>
            </button>

            {/* Popover Menu */}
            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-[var(--surface-1)] border border-[var(--border-subtle)] rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50">
                    <div className="p-2 space-y-1">
                        <button
                            onClick={() => openUserProfile()}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded-lg flex items-center gap-2"
                        >
                            <SettingsIcon className="w-3.5 h-3.5" />
                            Manage Account
                        </button>
                        <button
                            onClick={() => signOut()}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg flex items-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
