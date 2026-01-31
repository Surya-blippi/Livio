'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserButton, useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { DbVideo } from '@/lib/supabase';
import { ClockIcon, PlusIcon } from '../icons';
import { CreditsDisplay } from '../CreditsDisplay';
import SocialBonusCard from '../SocialBonusCard';

interface ResourcePanelProps {
    videoHistory: DbVideo[];
    onSelectVideo: (video: DbVideo) => void;
    onDeleteVideo: (id: string) => void;
    onNewProject: () => void;
}

export const ResourcePanel: React.FC<ResourcePanelProps> = ({
    videoHistory,
    onSelectVideo,
    onDeleteVideo,
    onNewProject
}) => {
    const { user } = useUser();
    const [showBonusModal, setShowBonusModal] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [claimStatus, setClaimStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected' | null>(null);

    useEffect(() => {
        setMounted(true);
        if (user) {
            fetch(`/api/credits/claim-bonus?userId=${user.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.claimed) {
                        setClaimStatus(data.status);
                    }
                })
                .catch(console.error);
        }
    }, [user]);

    return (
        <div className="flex flex-col h-full bg-[var(--surface-1)] border-r-2 border-[var(--border-strong)]">
            {/* Header / Brand */}
            <div className="h-14 flex items-center justify-between px-4">
                <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
                    <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                        <span className="text-lg font-black">R</span>
                    </div>
                    <span className="text-black">Reven</span>
                </div>
                <CreditsDisplay />
            </div>

            {/* Actions: New Project & Free Credits */}
            <div className="px-3 pt-4 pb-2 space-y-2">
                <button
                    onClick={onNewProject}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-lg)] border-2 border-[var(--border-strong)] bg-white hover:bg-[var(--surface-2)] text-[var(--text-primary)] font-bold text-sm transition-all hover:translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_#000]"
                >
                    <div className="w-5 h-5 rounded-full bg-[var(--brand-primary)] border border-black flex items-center justify-center">
                        <PlusIcon className="w-3 h-3 text-black" />
                    </div>
                    <span>New Project</span>
                </button>

                {claimStatus !== 'approved' && (
                    <button
                        onClick={() => setShowBonusModal(true)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-lg)] border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-sm transition-all text-left"
                    >
                        <div className="w-5 h-5 rounded-full bg-indigo-200 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                        </div>
                        <span>Get 500 Free Credits</span>
                    </button>
                )}
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
                <div className="px-3 py-2 text-xs font-black text-[var(--text-tertiary)] uppercase tracking-wider">
                    Recent
                </div>

                {videoHistory.length === 0 ? (
                    <div className="text-center py-10 text-[var(--text-tertiary)] text-xs font-medium">
                        No projects yet.
                    </div>
                ) : (
                    videoHistory.map((video) => (
                        <div
                            key={video.id}
                            onClick={() => onSelectVideo(video)}
                            className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-3)] cursor-pointer transition-colors"
                        >
                            <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-sm text-[var(--text-primary)] truncate">
                                    {video.topic || video.script?.substring(0, 30) || "Untitled Project"}
                                </h4>
                            </div>

                            {/* Delete Action (Hidden by default, visible on hover) */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onDeleteVideo(video.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-red-600 transition-opacity"
                                title="Delete Project"
                            >
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Footer / User Profile */}
            <div className="p-3 border-t-2 border-[var(--border-subtle)]">
                <div className="flex items-center gap-3 p-2 rounded-[var(--radius-lg)] hover:bg-[var(--surface-3)] cursor-pointer transition-colors">
                    <UserButton />
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-[var(--text-primary)]">My Account</span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">Free Plan</span>
                    </div>
                </div>
            </div>

            {/* Bonus Modal - Render conditionally but portal needs document which is only available on client */}
            {mounted && createPortal(
                <AnimatePresence>
                    {showBonusModal && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/70"
                                onClick={() => setShowBonusModal(false)}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-2 border-b flex justify-end">
                                    <button onClick={() => setShowBonusModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                        <svg className="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>
                                <div className="p-6">
                                    {/* Handle case where user isn't loaded yet gracefully, but button is visible so user likely exists. 
                                        If user is null, we can show a loader or just not show the form part.
                                    */}
                                    {user ? <SocialBonusCard userId={user.id} /> : <div className="p-4 text-center">Loading user data...</div>}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};
