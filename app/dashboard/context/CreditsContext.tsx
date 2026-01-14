'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { BuyCreditsModal } from '../components/BuyCreditsModal';
import { CREDIT_COSTS, estimateTotalCredits } from '@/lib/credits';

interface CreditsContextType {
    balance: number | null;
    loading: boolean;
    showBuyModal: boolean;
    openBuyModal: () => void;
    closeBuyModal: () => void;
    refetch: () => Promise<void>;
    checkCredits: (cost: number) => boolean;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [balance, setBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [showBuyModal, setShowBuyModal] = useState(false);

    const fetchCredits = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        fetchCredits();

        // Poll every 5 seconds
        const interval = setInterval(fetchCredits, 5000);

        // Listen for global updates
        const handleUpdate = () => fetchCredits();
        window.addEventListener('credits-updated', handleUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('credits-updated', handleUpdate);
        };
    }, [fetchCredits]);

    const openBuyModal = useCallback(() => setShowBuyModal(true), []);
    const closeBuyModal = useCallback(() => {
        setShowBuyModal(false);
        fetchCredits(); // Refresh on close in case of purchase
    }, [fetchCredits]);

    // Pre-check function: returns true if enough credits, false (and opens modal) if not
    const checkCredits = useCallback((cost: number): boolean => {
        if (balance === null) return false; // Fail safe if not loaded
        if (balance < cost) {
            openBuyModal();
            return false;
        }
        return true;
    }, [balance, openBuyModal]);

    return (
        <CreditsContext.Provider value={{
            balance,
            loading,
            showBuyModal,
            openBuyModal,
            closeBuyModal,
            refetch: fetchCredits,
            checkCredits
        }}>
            {children}
            <BuyCreditsModal isOpen={showBuyModal} onClose={closeBuyModal} />
        </CreditsContext.Provider>
    );
};

export const useCredits = () => {
    const context = useContext(CreditsContext);
    if (context === undefined) {
        throw new Error('useCredits must be used within a CreditsProvider');
    }
    return context;
};
