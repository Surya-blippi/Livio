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
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Buy Credits</h2>
                                <p className="text-gray-500 mt-1">Choose a package that fits your needs</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Packages Grid */}
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    className={`relative p-5 rounded-xl border-2 text-left transition-all 
                                        ${isPopular
                                            ? 'border-[var(--brand-primary)] bg-gradient-to-br from-lime-50 to-green-50'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }
                                        ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                                    `}
                                >
                                    {/* Popular Badge */}
                                    {isPopular && (
                                        <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 text-xs font-bold text-white bg-[var(--brand-primary)] rounded-full">
                                            POPULAR
                                        </span>
                                    )}

                                    {/* Package Name */}
                                    <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>

                                    {/* Credits */}
                                    <div className="mt-2 flex items-baseline gap-1">
                                        <span className="text-3xl font-extrabold text-gray-900">
                                            {pkg.credits.toLocaleString()}
                                        </span>
                                        <span className="text-gray-500">credits</span>
                                    </div>

                                    {/* Bonus */}
                                    {pkg.bonus > 0 && (
                                        <div className="mt-1 text-sm text-green-600 font-medium">
                                            +{pkg.bonus.toLocaleString()} bonus credits
                                        </div>
                                    )}

                                    {/* Price */}
                                    <div className="mt-3 flex items-center justify-between">
                                        <span className="text-2xl font-bold text-gray-900">${pkg.price}</span>
                                        <span className="text-xs text-gray-400">
                                            ${((pkg.price / (pkg.credits + pkg.bonus)) * 100).toFixed(1)}¢/credit
                                        </span>
                                    </div>

                                    {/* Loading Indicator */}
                                    {isLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                                            <div className="w-6 h-6 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                </motion.button>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="p-6 pt-0 text-center text-xs text-gray-400">
                        Secure payment powered by DodoPayments
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default BuyCreditsModal;
