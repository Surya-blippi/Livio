import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking video_jobs schema...');

    // Check columns
    const { data: columns, error } = await supabase
        .rpc('get_columns', { table_name: 'video_jobs' }) // Trying RPC first
        .catch(() => ({ data: null, error: 'RPC not found' }));

    // Fallback to direct query if RPC doesn't exist (likely restricted)
    // But we can try to insert a dummy record to see error

    try {
        console.log('Attempting to insert dummy job with new columns...');
        const { data, error } = await supabase
            .from('video_jobs')
            .insert({
                input_data: {},
                user_id: 'test',
                // user_uuid: '00000000-0000-0000-0000-000000000000', // Comment out to test
                job_type: 'faceless'
            })
            .select()
            .maybeSingle();

        if (error) {
            console.error('Insert failed:', error);
        } else {
            console.log('Insert success! Columns exist.');
            // Cleanup
            if (data) await supabase.from('video_jobs').delete().eq('id', data.id);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

checkSchema();
