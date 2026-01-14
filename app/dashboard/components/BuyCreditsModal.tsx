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
            {/* Backdrop */}
            <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/70"
                onClick={onClose}
            />

            {/* Modal Container - Full screen on mobile, centered on desktop */}
            <motion.div
                key="modal"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="
                    fixed z-[201] 
                    inset-0 sm:inset-auto
                    sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                    w-full sm:w-[90vw] sm:max-w-xl
                    h-full sm:h-auto sm:max-h-[85vh]
                    bg-white sm:rounded-2xl
                    flex flex-col
                    overflow-hidden
                    shadow-2xl
                "
                onClick={e => e.stopPropagation()}
            >
                {/* Sticky Header */}
                <div className="flex-shrink-0 sticky top-0 z-10 bg-white border-b-2 border-black p-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-black">Buy Credits</h2>
                        <p className="text-gray-500 text-sm">Power up your workflow</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-[#CCFF00] active:scale-95 transition-all border-2 border-transparent hover:border-black"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 pb-8">
                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-red-50 border-2 border-red-500 text-red-700 font-bold text-sm flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {/* Packages */}
                    <div className="space-y-4">
                        {CREDIT_PACKAGES.map((pkg) => {
                            const isLoading = loading === pkg.id;
                            const isPopular = pkg.id === 'pro';

                            return (
                                <button
                                    key={pkg.id}
                                    disabled={loading !== null}
                                    onClick={() => handlePurchase(pkg.id)}
                                    className={`
                                        relative w-full p-4 rounded-xl border-2 text-left transition-all
                                        ${isPopular
                                            ? 'bg-white border-[#CCFF00] shadow-[4px_4px_0px_#CCFF00]'
                                            : 'bg-white border-gray-200 hover:border-black shadow-[3px_3px_0px_#e5e7eb] hover:shadow-[4px_4px_0px_#000]'
                                        }
                                        ${loading ? 'opacity-50 pointer-events-none' : 'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'}
                                    `}
                                >
                                    {/* Popular Badge */}
                                    {isPopular && (
                                        <span className="absolute -top-2.5 left-3 px-2 py-0.5 text-[10px] font-black text-black bg-[#CCFF00] border-2 border-black rounded-full">
                                            MOST POPULAR
                                        </span>
                                    )}

                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-base font-black text-black uppercase">{pkg.name}</h3>
                                            <div className="mt-1 flex items-baseline gap-1">
                                                <span className="text-2xl font-black text-black">{pkg.credits.toLocaleString()}</span>
                                                <span className="text-gray-400 text-sm font-bold">credits</span>
                                            </div>
                                            {pkg.bonus > 0 && (
                                                <span className="mt-1 inline-block text-xs font-bold text-black bg-[#CCFF00]/30 px-2 py-0.5 rounded border border-[#CCFF00]">
                                                    +{pkg.bonus.toLocaleString()} bonus
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black text-black">${pkg.price}</div>
                                            <div className="text-[10px] text-gray-400 font-semibold">
                                                ${((pkg.price / (pkg.credits + pkg.bonus)) * 100).toFixed(1)}¢/credit
                                            </div>
                                        </div>
                                    </div>

                                    {/* Loading Spinner */}
                                    {isLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                                            <div className="w-6 h-6 border-3 border-[#CCFF00] border-t-black rounded-full animate-spin" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 p-4 border-t-2 border-gray-100 bg-gray-50 text-center">
                    <p className="text-xs text-gray-400 font-medium flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        Secure payment powered by DodoPayments
                    </p>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default BuyCreditsModal;
