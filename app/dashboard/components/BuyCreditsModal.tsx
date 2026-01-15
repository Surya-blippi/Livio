'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CREDIT_PACKAGES } from '@/lib/credits';

interface BuyCreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPurchaseComplete?: () => void;
    requiredAmount?: number | null;
    operationName?: string | null;
    currentBalance?: number | null;
}

export const BuyCreditsModal: React.FC<BuyCreditsModalProps> = ({
    isOpen,
    onClose,
    onPurchaseComplete,
    requiredAmount,
    operationName,
    currentBalance
}) => {
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);


    // Ensure we only render portal on client
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

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

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <AnimatePresence>
            {/* Full-screen overlay with high z-index */}
            <div
                className="fixed inset-0 flex items-center justify-center p-4"
                style={{ zIndex: 99999 }}
            >
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/70"
                    onClick={onClose}
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden border-2 border-black"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex-shrink-0 p-5 border-b-2 border-black bg-gray-50 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-black">Buy Credits</h2>
                            <p className="text-gray-500 text-sm">Power up your workflow</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-[#CCFF00] active:scale-95 transition-all border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
                            aria-label="Close"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-5">
                        {/* Contextual Requirement Message */}
                        {requiredAmount && operationName && (
                            <div className="mb-4 p-4 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-800">
                                <div className="flex items-start gap-3">
                                    <svg className="w-6 h-6 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <p className="font-bold text-sm">{operationName} requires {requiredAmount} credits</p>
                                        <p className="text-xs mt-1 text-amber-700">
                                            You currently have <span className="font-bold">{currentBalance ?? 0}</span> credits.
                                            Purchase a package below to continue.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 p-3 rounded-xl bg-red-50 border-2 border-red-500 text-red-700 font-bold text-sm flex items-center gap-2">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                                : 'bg-white border-gray-300 shadow-[3px_3px_0px_#d1d5db] hover:border-black hover:shadow-[4px_4px_0px_#000]'
                                            }
                                            ${loading ? 'opacity-50 pointer-events-none' : 'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'}
                                        `}
                                    >
                                        {/* Popular Badge */}
                                        {isPopular && (
                                            <span className="absolute -top-2.5 left-3 px-2 py-0.5 text-[10px] font-black text-black bg-[#CCFF00] border-2 border-black rounded-full shadow-[1px_1px_0px_#000]">
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
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-xl">
                                                <div className="w-6 h-6 border-3 border-[#CCFF00] border-t-black rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex-shrink-0 p-4 border-t-2 border-gray-200 bg-gray-50 text-center">
                        <p className="text-xs text-gray-400 font-medium flex items-center justify-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            Secure payment powered by DodoPayments
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );

    // Use Portal to render outside the React tree, directly into body
    return createPortal(modalContent, document.body);
};

export default BuyCreditsModal;
