import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params;

        if (!jobId) {
            return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
        }

        // Load job from Supabase
        const { data: job, error } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error || !job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        // Build response
        const response: Record<string, unknown> = {
            jobId: job.id,
            status: job.status,
            progress: job.progress || 0,
            progressMessage: job.progress_message || ''
        };

        if (job.status === 'completed' && job.result) {
            response.result = job.result;
        }

        if (job.status === 'failed' && job.error) {
            response.error = job.error;
        }

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error getting faceless job status:', error);
        return NextResponse.json(
            { error: 'Failed to get job status' },
            { status: 500 }
        );
    }
}
