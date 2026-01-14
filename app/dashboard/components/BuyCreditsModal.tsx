'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CREDIT_PACKAGES } from '@/lib/credits';

interface BuyCreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPurchaseComplete?: () => void;
}

export const BuyCreditsModal: React.FC<BuyCreditsModalProps> = ({
    isOpen,
    onClose,
    onPurchaseComplete
}) => {
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handlePurchase = async (packageId: string) => {
        setLoading(packageId);
        setError(null);

        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packageId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create checkout');
            }

            // Redirect to DodoPayments checkout
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setLoading(null);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: '100%', opacity: 0, scale: 0.96 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: '100%', opacity: 0, scale: 0.96 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300, mass: 0.8 }}
                    className="
                        bg-[var(--surface-1)] border-t-2 sm:border-2 border-[var(--border-strong)] 
                        rounded-t-3xl sm:rounded-[var(--radius-xl)] 
                        shadow-[0px_-8px_30px_rgba(0,0,0,0.3)] sm:shadow-[8px_8px_0px_rgba(0,0,0,0.5)] 
                        w-full max-w-2xl 
                        max-h-[85dvh] sm:max-h-[85vh] 
                        overflow-hidden flex flex-col
                    "
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-5 sm:p-6 border-b-2 border-[var(--border-strong)] flex items-center justify-between flex-shrink-0 bg-[var(--surface-2)] relative">
                        {/* Mobile Pull Handle (Visual only) */}
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-300 rounded-full sm:hidden" />

                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">Buy Credits</h2>
                            <p className="text-[var(--text-secondary)] text-sm font-medium mt-0.5">Power up your creation workflow</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--brand-primary)] hover:text-black border-2 border-transparent hover:border-[var(--border-strong)] transition-all active:translate-y-0.5"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content (Scrollable) */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 pb-20 sm:pb-6">

                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 p-4 rounded-[var(--radius-md)] border-2 border-red-500 bg-red-50 text-red-900 font-bold text-sm flex items-center gap-2">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {/* Packages Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                            {CREDIT_PACKAGES.map((pkg) => {
                                const isLoading = loading === pkg.id;
                                const isPopular = pkg.id === 'pro';

                                return (
                                    <motion.button
                                        key={pkg.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        disabled={loading !== null}
                                        onClick={() => handlePurchase(pkg.id)}
                                        className={`group relative p-5 rounded-[var(--radius-lg)] border-2 text-left transition-all duration-200
                                            ${isPopular
                                                ? 'bg-[var(--surface-1)] border-[var(--brand-primary)] shadow-[4px_4px_0px_var(--brand-primary)]'
                                                : 'bg-[var(--surface-1)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] shadow-[3px_3px_0px_var(--border-subtle)] hover:shadow-[4px_4px_0px_var(--border-strong)]'
                                            }
                                            ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                        `}
                                    >
                                        {/* Popular Badge */}
                                        {isPopular && (
                                            <span className="absolute -top-3 left-4 px-3 py-1 text-xs font-black text-black bg-[var(--brand-primary)] border-2 border-black rounded-full shadow-[2px_2px_0px_#000]">
                                                MOST POPULAR
                                            </span>
                                        )}

                                        <div className="flex flex-col h-full justify-between gap-3">
                                            <div>
                                                <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-wide">{pkg.name}</h3>

                                                <div className="mt-2 flex items-baseline gap-1">
                                                    <span className="text-3xl sm:text-4xl font-black text-[var(--text-primary)]">
                                                        {pkg.credits.toLocaleString()}
                                                    </span>
                                                    <span className="text-[var(--text-tertiary)] font-bold text-sm">credits</span>
                                                </div>

                                                {pkg.bonus > 0 && (
                                                    <div className="mt-2 text-xs sm:text-sm font-bold text-black bg-[var(--brand-primary)]/20 inline-block px-2 py-1 rounded-md border border-[var(--brand-primary)]">
                                                        +{pkg.bonus.toLocaleString()} bonus
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-3 border-t-2 border-dashed border-[var(--border-subtle)] group-hover:border-[var(--border-strong)] transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">${pkg.price}</span>
                                                    <span className="text-[10px] sm:text-xs font-semibold text-[var(--text-tertiary)] bg-[var(--surface-3)] px-2 py-1 rounded">
                                                        ${((pkg.price / (pkg.credits + pkg.bonus)) * 100).toFixed(1)}¢ / credit
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Loading Overlay */}
                                        {isLoading && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10 rounded-[var(--radius-lg)]">
                                                <div className="w-8 h-8 border-4 border-[var(--brand-primary)] border-t-black rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </motion.button>
                                );
                            })}
                        </div>
                        {/* Spacing element for mobile scrolling */}
                        <div className="h-4 sm:hidden" />
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-[var(--surface-2)] border-t-2 border-[var(--border-strong)] text-center pb-safe">
                        <p className="text-xs font-semibold text-[var(--text-tertiary)] flex items-center justify-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            Secure payment powered by DodoPayments
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default BuyCreditsModal;
