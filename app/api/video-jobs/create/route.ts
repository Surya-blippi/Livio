import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
    try {
        const { userId: clerkUserId } = await auth();

        if (!clerkUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const {
            job_type,
            input_data,
            user_id, // This is the UUID
            // We use the UUID from body, but verify ownership via Clerk ID
        } = body;

        const supabase = getSupabaseAdmin();

        // 1. Verify that the user_id (UUID) provided matches the logged-in Clerk User
        const { data: userRecord, error: userError } = await supabase
            .from('users')
            .select('id, clerk_id')
            .eq('id', user_id)
            .single();

        if (userError || !userRecord) {
            console.error('User lookup failed:', userError);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (userRecord.clerk_id !== clerkUserId) {
            console.error('User verification failed. Clerk ID mismatch.');
            return NextResponse.json({ error: 'Unauthorized: User mismatch' }, { status: 403 });
        }

        // 2. Insert the job as Admin (bypassing RLS)
        const { data: job, error: insertError } = await supabase
            .from('video_jobs')
            .insert({
                user_id: user_id, // For legacy
                user_uuid: user_id, // For FK
                job_type,
                status: 'pending',
                input_data,
                progress: 0,
                progress_message: 'Initializing...'
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error creating job:', insertError);
            return NextResponse.json({ error: 'Failed to create job', details: insertError }, { status: 400 });
        }

        return NextResponse.json({ job });
    } catch (e: any) {
        console.error('Server error creating job:', e);
        return NextResponse.json({ error: 'Internal Server Error', details: e.message }, { status: 500 });
    }
}
