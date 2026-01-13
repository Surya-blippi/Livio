import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;



// ACCESS TO EVERYTHING - USE ONLY IN SECURE SERVER-SIDE ROUTES
// Factory function to ensure we read env vars at RUNTIME, not build time
export const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error('❌ FATAL: Missing Supabase configuration');
        throw new Error('Server configuration error: Missing database credentials');
    }

    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

// Lazy initialization for legacy imports
// This attempts to create it once, but if env vars are missing, it might fail or be a placeholder.
// Prefer using getSupabaseAdmin() in API routes.
const activeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const activeKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

export const supabaseAdmin = createClient(activeUrl, activeKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
