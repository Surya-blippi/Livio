import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params;

        if (!jobId) {
            return NextResponse.json(
                { error: 'Missing job ID' },
                { status: 400 }
            );
        }

        // Fetch job from Supabase
        const { data: job, error } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error || !job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        // Extract scene progress for checklist UI
        const inputData = job.input_data as { scenes?: unknown[] } | null;
        const totalScenes = inputData?.scenes?.length || 0;
        const currentSceneIndex = job.current_scene_index || 0;
        const processedScenes = job.processed_scenes || [];

        // Return job status and result
        return NextResponse.json({
            jobId: job.id,
            status: job.status,
            progress: job.progress,
            progressMessage: job.progress_message,
            result: job.result_data,
            error: job.error,
            createdAt: job.created_at,
            updatedAt: job.updated_at,
            // Scene progress for checklist
            totalScenes,
            currentSceneIndex,
            processedScenesCount: processedScenes.length,
            isRendering: job.input_data?.pendingRender ? true : false
        });


    } catch (error) {
        console.error('Error fetching job status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch job status' },
            { status: 500 }
        );
    }
}
