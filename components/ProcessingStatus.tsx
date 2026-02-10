'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ProcessingStatusProps {
    message: string;
    progress?: number;
    subMessage?: string;
}

export default function ProcessingStatus({ message, progress, subMessage }: ProcessingStatusProps) {
    return (
        <div className="w-full max-w-2xl mx-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="glass-strong p-12 text-center"
            >
                {/* Animated spinner */}
                <div className="mb-8 flex justify-center">
                    <div className="relative">
                        <div className="spinner w-20 h-20" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 bg-[var(--brand-primary)] rounded-full opacity-20 animate-ping" />
                        </div>
                    </div>
                </div>

                {/* Message */}
                <h3 className="text-2xl font-bold mb-3 gradient-text">
                    {message}
                </h3>

                {subMessage && (
                    <p className="text-[var(--text-secondary)] mb-6">
                        {subMessage}
                    </p>
                )}

                {/* Progress bar */}
                {progress !== undefined && (
                    <div className="mb-4">
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mt-2">{progress}% complete</p>
                    </div>
                )}

                {/* Fun facts or tips while waiting */}
                <div className="mt-8 p-4 bg-[var(--surface-2)] border-2 border-black rounded-lg">
                    <p className="text-sm text-[var(--text-secondary)]">
                        <strong>Did you know?</strong> AI can now clone voices with just 10 seconds of audio!
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
