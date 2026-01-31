'use client';

import { useUser } from '@clerk/nextjs';

// ... imports

export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useUser();
    const [balance, setBalance] = useState<number | null>(null);
    // ... rest of state

    // ... existing logic

    return (
        <CreditsContext.Provider value={{
            // ... context values
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
                userId={user?.id}
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
