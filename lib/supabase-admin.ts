import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;



// ACCESS TO EVERYTHING - USE ONLY IN SECURE SERVER-SIDE ROUTES
// Factory function to ensure we read env vars at RUNTIME, not build time
export const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Debug logging - show env var presence and lengths (not actual values for security)
    console.log(`🔑 Supabase Admin Init Debug:`);
    console.log(`   URL present: ${!!supabaseUrl}, length: ${supabaseUrl?.length || 0}`);
    console.log(`   Key present: ${!!supabaseServiceRoleKey}, length: ${supabaseServiceRoleKey?.length || 0}`);
    console.log(`   Key starts with: ${supabaseServiceRoleKey?.substring(0, 10) || 'N/A'}...`);

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error('❌ FATAL: Service Role Key missing in getSupabaseAdmin()');
        console.error(`   URL: ${!!supabaseUrl}, Key: ${!!supabaseServiceRoleKey}`);
        throw new Error('Service Role Key invalid');
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
