import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;



// ACCESS TO EVERYTHING - USE ONLY IN SECURE SERVER-SIDE ROUTES
const activeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const activeKey = supabaseServiceRoleKey || 'placeholder-key';

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('⚠️ Service Role Key missing. Supabase Admin client will not work.');
}

export const supabaseAdmin = createClient(activeUrl, activeKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
