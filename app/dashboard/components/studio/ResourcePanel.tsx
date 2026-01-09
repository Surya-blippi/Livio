import React from 'react';
import { UserButton } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { DbVideo } from '@/lib/supabase';
import { ClockIcon, PlusIcon } from '../icons';

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
    return (
        <div className="flex flex-col h-full bg-[var(--surface-1)] border-r-2 border-[var(--border-strong)]">
            {/* Header / Brand */}
            <div className="h-14 flex items-center px-4">
                <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
                    <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                        <span className="text-lg font-black">P</span>
                    </div>
                    <span className="text-black">Pocket</span>
                </div>
            </div>

            {/* New Project Button */}
            <div className="px-3 pt-4 pb-2">
                <button
                    onClick={onNewProject}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-lg)] border-2 border-[var(--border-strong)] bg-white hover:bg-[var(--surface-2)] text-[var(--text-primary)] font-bold text-sm transition-all hover:translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_#000]"
                >
                    <div className="w-5 h-5 rounded-full bg-[var(--brand-primary)] border border-black flex items-center justify-center">
                        <PlusIcon className="w-3 h-3 text-black" />
                    </div>
                    <span>New Project</span>
                </button>
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
        </div>
    );
};
