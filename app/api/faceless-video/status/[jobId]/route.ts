import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params;

        console.log(`\n========== CHECK STATUS: ${jobId} ==========`);

        let supabase;
        try {
            supabase = getSupabaseAdmin();
        } catch (e) {
            console.error('Failed to get Admin Client:', e);
            const msg = e instanceof Error ? e.message : 'Unknown config error';
            return NextResponse.json({ error: 'Server Config Error', details: msg }, { status: 500 });
        }

        // Load job from Supabase
        const { data: job, error } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error || !job) {
            console.error(`Job ${jobId} not found in status check.`);
            console.error(`Error details:`, error);
            return NextResponse.json({ error: 'Job not found', details: error }, { status: 404 });
        }

        // Build response
        const response: Record<string, unknown> = {
            jobId: job.id,
            status: job.status,
            progress: job.progress || 0,
            progressMessage: job.progress_message || '',
            // Expose scene progress if available
            currentSceneIndex: job.input_data?.currentSceneIndex,
            totalScenes: job.input_data?.scenes?.length,
            processedScenesCount: job.input_data?.processedScenes?.length,
            isRendering: !!job.input_data?.pendingRender
        };

        if (job.status === 'completed' && job.result_data) {
            response.result = job.result_data;
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
