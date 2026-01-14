
import React from 'react';
import { CreditsDisplay } from './CreditsDisplay';

interface MobileNavBarProps {
    onOpenHistory: () => void;
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({ onOpenHistory }) => {
    return (
        <div className="h-14 bg-white/95 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between px-4 z-40 fixed top-0 left-0 right-0 safe-area-top">
            {/* Hamburger Menu */}
            <button
                onClick={onOpenHistory}
                className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            {/* Logo/Title - Consistent with Desktop ResourcePanel */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                    <span className="text-lg font-black text-black">R</span>
                </div>
                <span className="font-black text-lg text-black">Reven</span>
            </div>

            {/* Credits Display */}
            <CreditsDisplay />
        </div>
    );
};
