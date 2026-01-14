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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all active:translate-y-0.5
                    ${isLowBalance
                        ? 'bg-red-50 border-red-500 text-red-600 shadow-[2px_2px_0px_#ef4444] hover:shadow-[3px_3px_0px_#ef4444] hover:-translate-y-0.5'
                        : 'bg-white border-[var(--border-strong)] text-[var(--text-primary)] shadow-[2px_2px_0px_var(--border-strong)] hover:shadow-[3px_3px_0px_var(--brand-primary)] hover:border-[var(--brand-primary)] hover:-translate-y-0.5'
                    }
                    ${className}`}
                title={isLowBalance ? 'Low balance - Add credits' : 'Your credit balance'}
            >
                {/* Coin icon */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${isLowBalance ? 'bg-red-100 border-red-500' : 'bg-[var(--brand-primary)] border-black'}`}
                >
                    <span className="text-[10px] font-black leading-none text-black">$</span>
                </div>

                <span className="font-bold text-sm leading-none pt-0.5">{balance?.toLocaleString() ?? '0'}</span>

                {isLowBalance && (
                    <span className="text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded-full ml-0.5 leading-none">
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

