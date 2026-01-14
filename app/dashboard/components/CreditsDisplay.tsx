'use client';

import React, { useEffect, useState } from 'react';
import { BuyCreditsModal } from './BuyCreditsModal';

interface CreditsDisplayProps {
    className?: string;
}

export const CreditsDisplay: React.FC<CreditsDisplayProps> = ({ className = '' }) => {
    const [balance, setBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchCredits();

        // Poll for credit updates every 5 seconds
        const interval = setInterval(fetchCredits, 5000);

        // Listen for global credit update events (optional, can be added to other components)
        const handleUpdate = () => fetchCredits();
        window.addEventListener('credits-updated', handleUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('credits-updated', handleUpdate);
        };
    }, []);

    const fetchCredits = async () => {
        try {
            const res = await fetch('/api/credits');
            if (res.ok) {
                const data = await res.json();
                setBalance(data.balance);
            }
        } catch (error) {
            console.error('Failed to fetch credits:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleModalClose = () => {
        setShowModal(false);
        // Refetch credits in case of successful purchase
        fetchCredits();
    };

    const isLowBalance = balance !== null && balance < 100;

    if (loading) {
        return (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 animate-pulse ${className}`}>
                <div className="w-4 h-4 rounded-full bg-gray-200" />
                <div className="w-8 h-3 rounded bg-gray-200" />
            </div>
        );
    }

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all font-semibold text-sm
                    ${isLowBalance
                        ? 'bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 border border-orange-200'
                        : 'bg-gradient-to-r from-[var(--brand-primary)]/20 to-lime-100 text-gray-800 border border-[var(--brand-primary)]/30'
                    }
                    hover:scale-105 active:scale-95 ${className}`}
                title={isLowBalance ? 'Low balance - Add credits' : 'Your credit balance'}
            >
                {/* Coin icon */}
                <svg
                    className={`w-4 h-4 ${isLowBalance ? 'text-orange-500' : 'text-[var(--brand-primary)]'}`}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
                </svg>
                <span>{balance?.toLocaleString() ?? '0'}</span>
                {isLowBalance && (
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-200 px-1.5 py-0.5 rounded-full ml-0.5">
                        LOW
                    </span>
                )}
            </button>

            <BuyCreditsModal
                isOpen={showModal}
                onClose={handleModalClose}
            />
        </>
    );
};

export default CreditsDisplay;

