'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createAuthenticatedClient, supabase as defaultClient } from '@/lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

type SupabaseContextType = {
    supabase: SupabaseClient;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, userId } = useAuth();
    const [supabase, setSupabase] = useState<SupabaseClient>(defaultClient);

    useEffect(() => {
        let isMounted = true;

        const initClient = async () => {
            try {
                const token = await getToken({ template: 'supabase' });

                if (isMounted) {
                    if (token) {
                        // Create authenticated client
                        // Using a simple check to avoid unnecessary recreation if token is same 
                        // (though we can't easily check token string equality without storing it, 
                        // typical React updates handle dependency changes well)
                        const client = createAuthenticatedClient(token);
                        setSupabase(client);
                    } else {
                        // Fallback/Logout
                        setSupabase(defaultClient);
                    }
                }
            } catch (error) {
                console.error('[SupabaseProvider] Failed to get token:', error);
            }
        };

        if (userId) {
            initClient();
        } else {
            setSupabase(defaultClient);
        }

        return () => {
            isMounted = false;
        };
    }, [getToken, userId]);

    return (
        <SupabaseContext.Provider value={{ supabase }}>
            {children}
        </SupabaseContext.Provider>
    );
}

export const useSupabase = () => {
    const context = useContext(SupabaseContext);
    if (context === undefined) {
        throw new Error('useSupabase must be used within a SupabaseProvider');
    }
    return context.supabase;
};
