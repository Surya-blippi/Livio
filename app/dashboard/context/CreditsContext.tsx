'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { BuyCreditsModal } from '../components/BuyCreditsModal';
import { CREDIT_COSTS, estimateTotalCredits } from '@/lib/credits';

interface CreditsContextType {
    balance: number | null;
    loading: boolean;
    showBuyModal: boolean;
    openBuyModal: () => void;
    openBuyModalWithContext: (cost: number, operationName: string) => void;
    closeBuyModal: () => void;
    refetch: () => Promise<void>;
    checkCredits: (cost: number) => boolean;
    checkCreditsWithContext: (cost: number, operationName: string) => boolean;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [balance, setBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [showBuyModal, setShowBuyModal] = useState(false);
    const [requiredAmount, setRequiredAmount] = useState<number | null>(null);
    const [operationName, setOperationName] = useState<string | null>(null);

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

        // Poll every 15 seconds (reduced from 5s to save API calls)
        const interval = setInterval(fetchCredits, 15000);

        // Listen for global updates
        const handleUpdate = () => fetchCredits();
        window.addEventListener('credits-updated', handleUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('credits-updated', handleUpdate);
        };
    }, [fetchCredits]);

    const openBuyModal = useCallback(() => {
        setRequiredAmount(null);
        setOperationName(null);
        setShowBuyModal(true);
    }, []);

    const openBuyModalWithContext = useCallback((cost: number, operation: string) => {
        setRequiredAmount(cost);
        setOperationName(operation);
        setShowBuyModal(true);
    }, []);

    const closeBuyModal = useCallback(() => {
        setShowBuyModal(false);
        setRequiredAmount(null);
        setOperationName(null);
        fetchCredits(); // Refresh on close in case of purchase
    }, [fetchCredits]);

    // Pre-check function: returns true if enough credits, false (and opens modal) if not
    const checkCredits = useCallback((cost: number): boolean => {
        // If balance is still loading or insufficient, open the modal
        if (balance === null || balance < cost) {
            openBuyModal();
            return false;
        }
        return true;
    }, [balance, openBuyModal]);

    // Pre-check with contextual message
    const checkCreditsWithContext = useCallback((cost: number, operation: string): boolean => {
        // If balance is still loading or insufficient, open the modal with context
        if (balance === null || balance < cost) {
            openBuyModalWithContext(cost, operation);
            return false;
        }
        return true;
    }, [balance, openBuyModalWithContext]);

    return (
        <CreditsContext.Provider value={{
            balance,
            loading,
            showBuyModal,
            openBuyModal,
            openBuyModalWithContext,
            closeBuyModal,
            refetch: fetchCredits,
            checkCredits,
            checkCreditsWithContext
        }}>
            {children}
            <BuyCreditsModal
                isOpen={showBuyModal}
                onClose={closeBuyModal}
                requiredAmount={requiredAmount}
                operationName={operationName}
                currentBalance={balance}
            />
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
