import React from 'react';
import { motion } from 'framer-motion';
import { DbVideo } from '@/lib/supabase';

// Icon Components (Localized to keep this file self-contained or import from a shared icons file later)
const ClockIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
);

const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const DownloadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

interface HistoryPanelProps {
    videos: DbVideo[];
    onDelete: (id: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ videos, onDelete }) => {
    return (
        <div className="h-full flex flex-col bg-[var(--surface-2)] border-l border-[var(--border-subtle)] w-80 lg:w-96 shadow-xl z-30">
            <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-2)]">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Your Creations</h3>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--surface-3)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                    {videos.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {videos.length > 0 ? (
                    videos.map((video) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            key={video.id}
                            className="group relative bg-[var(--surface-1)] rounded-[var(--radius-md)] p-3 border border-[var(--border-subtle)] hover:border-[var(--brand-primary)] hover:shadow-md transition-all duration-200"
                        >
                            <div className="flex gap-4">
                                {/* Thumbnail Placeholder */}
                                <div className="relative w-24 aspect-[9/16] rounded-[var(--radius-sm)] overflow-hidden bg-[var(--surface-2)] border border-[var(--border-subtle)] shrink-0 shadow-sm group-hover:shadow-md transition-shadow flex items-center justify-center">
                                    <svg className="w-8 h-8 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>

                                {/* Content */}
                                <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1.5 self-start flex-wrap">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${video.mode === 'face' ? 'bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border-subtle)]' : 'bg-[var(--brand-primary)] text-black border border-black'}`}>
                                                {video.mode === 'face' ? 'Face' : 'Faceless'}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium leading-snug text-[var(--text-primary)] line-clamp-2" title={video.script}>
                                            {video.script}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mt-2">
                                        <span className="flex items-center gap-1">
                                            <ClockIcon /> {video.duration}s
                                        </span>
                                        {video.has_captions && (
                                            <span title="Captions Enabled">📝</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions Overlay */}
                            <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1 rounded-lg border border-[var(--border-subtle)]">
                                <button
                                    onClick={() => onDelete(video.id)}
                                    className="p-1.5 rounded-md hover:bg-red-500 hover:text-white text-[var(--text-secondary)] transition-colors"
                                    title="Delete Video"
                                >
                                    <TrashIcon />
                                </button>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                        <div className="text-4xl mb-2">🎬</div>
                        <p className="font-medium text-[var(--text-secondary)]">No videos yet</p>
                        <p className="text-xs text-[var(--text-tertiary)]">Create your first story</p>
                    </div>
                )}
            </div>
        </div>
    );
};
