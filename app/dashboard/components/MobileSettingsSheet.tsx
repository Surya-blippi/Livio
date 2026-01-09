'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MicIcon, ClockIcon, VideoIcon, CloseIcon } from './icons';

interface MobileSettingsSheetProps {
    isOpen: boolean;
    onClose: () => void;

    // Mode
    mode: 'face' | 'faceless';
    setMode: (mode: 'face' | 'faceless') => void;
    avatarUrl?: string;
    onSelectFace: () => void;

    // Voice
    voiceName: string;
    onSelectVoice: () => void;

    // Duration
    duration: number;
    setDuration: (d: number) => void;

    // Aspect Ratio
    aspectRatio: string;
    setAspectRatio: (r: string) => void;
}

export const MobileSettingsSheet: React.FC<MobileSettingsSheetProps> = ({
    isOpen,
    onClose,
    mode,
    setMode,
    avatarUrl,
    onSelectFace,
    voiceName,
    onSelectVoice,
    duration,
    setDuration,
    aspectRatio,
    setAspectRatio
}) => {
    const durations = [15, 30, 60];
    const aspectRatios = [
        { value: '9:16', label: 'Vertical', desc: 'TikTok/Reels' },
        { value: '16:9', label: 'Horizontal', desc: 'YouTube' },
        { value: '1:1', label: 'Square', desc: 'Instagram' }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-50 max-h-[85vh] overflow-hidden"
                    >
                        {/* Handle */}
                        <div className="flex justify-center py-3">
                            <div className="w-10 h-1 bg-gray-300 rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pb-4 border-b border-gray-100">
                            <h2 className="text-xl font-black">Settings</h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-gray-100"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-8 overflow-y-auto max-h-[calc(85vh-100px)]">

                            {/* Mode Selection */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Video Mode</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setMode('faceless')}
                                        className={`p-4 rounded-2xl border-2 transition-all ${mode === 'faceless'
                                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gray-200 flex items-center justify-center">
                                            <svg className="w-6 h-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                            </svg>
                                        </div>
                                        <p className="font-bold text-center">Faceless</p>
                                        <p className="text-xs text-gray-500 text-center">Images only</p>
                                    </button>

                                    <button
                                        onClick={() => { setMode('face'); onSelectFace(); }}
                                        className={`p-4 rounded-2xl border-2 transition-all ${mode === 'face'
                                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center overflow-hidden">
                                            {avatarUrl ? (
                                                <img src={avatarUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-white text-lg">👤</span>
                                            )}
                                        </div>
                                        <p className="font-bold text-center">Face</p>
                                        <p className="text-xs text-gray-500 text-center">With avatar</p>
                                    </button>
                                </div>
                            </section>

                            {/* Voice Selection */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Voice</h3>
                                <button
                                    onClick={onSelectVoice}
                                    className="w-full p-4 rounded-2xl border-2 border-gray-200 hover:border-gray-300 flex items-center gap-4 transition-all"
                                >
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center">
                                        <MicIcon className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-bold">{voiceName}</p>
                                        <p className="text-sm text-gray-500">Tap to change</p>
                                    </div>
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </section>

                            {/* Duration */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Duration</h3>
                                <div className="flex gap-3">
                                    {durations.map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setDuration(d)}
                                            className={`flex-1 py-4 rounded-2xl border-2 font-bold transition-all ${duration === d
                                                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-black'
                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            {d}s
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Aspect Ratio */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Aspect Ratio</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {aspectRatios.map((ar) => (
                                        <button
                                            key={ar.value}
                                            onClick={() => setAspectRatio(ar.value)}
                                            className={`p-4 rounded-2xl border-2 transition-all ${aspectRatio === ar.value
                                                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className={`mx-auto mb-2 border-2 border-current ${ar.value === '9:16' ? 'w-6 h-10' :
                                                    ar.value === '16:9' ? 'w-10 h-6' :
                                                        'w-8 h-8'
                                                } rounded ${aspectRatio === ar.value ? 'border-[var(--brand-primary)]' : 'border-gray-400'}`} />
                                            <p className="text-xs font-bold text-center">{ar.label}</p>
                                        </button>
                                    ))}
                                </div>
                            </section>

                        </div>

                        {/* Bottom padding for safe area */}
                        <div className="h-8 safe-area-bottom" />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
