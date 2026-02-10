'use client';

import React, { useState } from 'react';
import { validateScript, estimateReadingTime } from '@/lib/validation';
import { motion } from 'framer-motion';

interface ScriptDisplayProps {
    script: string;
    topic: string;
    onScriptConfirm: (finalScript: string) => void;
    onRegenerate: () => void;
    isRegenerating?: boolean;
}

export default function ScriptDisplay({
    script: initialScript,
    topic,
    onScriptConfirm,
    onRegenerate,
    isRegenerating = false
}: ScriptDisplayProps) {
    const [script, setScript] = useState(initialScript);
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState('');

    const readingTime = estimateReadingTime(script);
    const wordCount = script.trim().split(/\s+/).length;

    const handleConfirm = () => {
        const validation = validateScript(script);

        if (!validation.valid) {
            setError(validation.error || 'Invalid script');
            return;
        }

        setError('');
        onScriptConfirm(script);
    };

    React.useEffect(() => {
        setScript(initialScript);
    }, [initialScript]);

    return (
        <div className="w-full max-w-2xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h2 className="text-3xl font-bold mb-2 gradient-text text-center">
                    Your Script is Ready!
                </h2>
                <p className="text-[var(--text-secondary)] text-center mb-8">
                    Review and edit if needed
                </p>

                <div className="glass-strong p-8">
                    {/* Topic display */}
                    <div className="mb-6 pb-6 border-b border-[var(--border-subtle)]">
                        <span className="text-sm text-[var(--text-tertiary)]">Topic:</span>
                        <p className="text-lg font-medium mt-1">{topic}</p>
                    </div>

                    {/* Script editor */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <label htmlFor="script" className="block text-sm font-medium">
                                Generated Script
                            </label>
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                {isEditing ? '✓ Done Editing' : '✏️ Edit'}
                            </button>
                        </div>

                        {isEditing ? (
                            <textarea
                                id="script"
                                value={script}
                                onChange={(e) => {
                                    setScript(e.target.value);
                                    setError('');
                                }}
                                className="w-full px-4 py-3 bg-[var(--surface-1)] border-2 border-[var(--border-subtle)] rounded-lg focus:outline-none focus:border-[var(--border-strong)] transition-all text-[var(--text-primary)] min-h-[150px] resize-y"
                                maxLength={2000}
                            />
                        ) : (
                            <div className="px-4 py-3 bg-[var(--surface-2)] border-2 border-[var(--border-subtle)] rounded-lg min-h-[150px] text-[var(--text-primary)] leading-relaxed">
                                {script}
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="flex gap-6 text-sm text-[var(--text-secondary)] mb-6">
                        <div>
                            <span className="font-medium">{wordCount}</span> words
                        </div>
                        <div>
                            <span className="font-medium">{script.length}</span> characters
                        </div>
                        <div>
                            ~<span className="font-medium">{readingTime}</span> seconds
                        </div>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm"
                        >
                            {error}
                        </motion.div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onRegenerate}
                            disabled={isRegenerating}
                            className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isRegenerating ? (
                                <>
                                    <div className="spinner w-5 h-5" />
                                    Regenerating...
                                </>
                            ) : (
                                <>
                                    🔄 Regenerate
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleConfirm}
                            disabled={isRegenerating}
                            className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue →
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
