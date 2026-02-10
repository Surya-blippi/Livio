'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { showToast } from '@/lib/toast';

interface VideoPlayerProps {
    videoUrl: string;
    onCreateNew: () => void;
}

export default function VideoPlayer({ videoUrl, onCreateNew }: VideoPlayerProps) {
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `pocket-influencer-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'My AI Talking Head Video',
                    text: 'Check out this AI-generated talking head video!',
                    url: videoUrl
                });
            } catch (err) {
                console.log('Error sharing:', err);
                showToast({ type: 'warning', message: 'Share canceled.' });
            }
        } else {
            // Fallback: copy to clipboard
            try {
                await navigator.clipboard.writeText(videoUrl);
                showToast({ type: 'success', message: 'Video link copied to clipboard.' });
            } catch {
                showToast({ type: 'error', message: 'Unable to copy video link.' });
            }
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <div className="text-center mb-8">
                    <h2 className="text-4xl font-bold mb-3">
                        <span className="text-[var(--text-primary)]">Your Video is Ready! 🎉</span>
                    </h2>
                    <p className="text-[var(--text-secondary)] text-lg">
                        Download, share, or create another one
                    </p>
                </div>

                <div className="glass-strong p-6">
                    {/* Video player */}
                    <div className="relative rounded-xl overflow-hidden mb-6 shadow-2xl">
                        <video
                            src={videoUrl}
                            controls
                            autoPlay
                            loop
                            className="w-full"
                            style={{ maxHeight: '600px' }}
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={handleDownload}
                            className="btn-primary flex items-center justify-center gap-2"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                            </svg>
                            Download
                        </button>

                        <button
                            onClick={handleShare}
                            className="btn-secondary flex items-center justify-center gap-2"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                />
                            </svg>
                            Share
                        </button>

                        <button
                            onClick={onCreateNew}
                            className="btn-primary flex items-center justify-center gap-2"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4v16m8-8H4"
                                />
                            </svg>
                            Create New
                        </button>
                    </div>

                    {/* Stats or info */}
                    <div className="mt-6 p-4 bg-[var(--surface-2)] border-2 border-black rounded-lg">
                        <p className="text-sm text-center text-[var(--text-secondary)]">
                            ✨ <strong>Pro Tip:</strong> Share your creation on social media using #PocketInfluencer
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
