'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface Step {
    number: number;
    title: string;
    description: string;
}

interface ProgressTrackerProps {
    currentStep: number;
    steps: Step[];
}

export default function ProgressTracker({ currentStep, steps }: ProgressTrackerProps) {
    return (
        <div className="w-full max-w-4xl mx-auto mb-12">
            <div className="glass p-6 rounded-2xl">
                {/* Progress bar */}
                <div className="progress-bar mb-6">
                    <div
                        className="progress-fill"
                        style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                    />
                </div>

                {/* Steps */}
                <div className="grid grid-cols-5 gap-4">
                    {steps.map((step, index) => {
                        const isCompleted = currentStep > step.number;
                        const isCurrent = currentStep === step.number;
                        const isPending = currentStep < step.number;

                        return (
                            <motion.div
                                key={step.number}
                                className="relative"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                {/* Step indicator */}
                                <div className="flex flex-col items-center text-center">
                                    <div
                                        className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mb-2 transition-all duration-300 ${isCompleted
                                                ? 'bg-[var(--brand-primary)] text-black border-2 border-black shadow-[3px_3px_0px_#000]'
                                                : isCurrent
                                                    ? 'bg-black text-[var(--brand-primary)] border-2 border-black shadow-[3px_3px_0px_#000] animate-pulse-slow'
                                                    : 'bg-[var(--surface-3)] text-[var(--text-tertiary)] border-2 border-[var(--border-subtle)]'
                                            }`}
                                    >
                                        {isCompleted ? '✓' : step.number}
                                    </div>

                                    <div className={`${isCurrent ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>
                                        <p className="text-xs mb-1">{step.title}</p>
                                        {isCurrent && (
                                            <p className="text-[10px] text-[var(--text-tertiary)]">{step.description}</p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
