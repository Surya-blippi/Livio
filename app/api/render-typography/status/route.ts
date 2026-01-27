import { NextRequest, NextResponse } from 'next/server';
import { getRenderProgress } from '@remotion/lambda/client';
import { supabase, createAuthenticatedClient, getOrCreateUser } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

const REMOTION_AWS_REGION = process.env.REMOTION_AWS_REGION || 'eu-north-1';
const FUNCTION_NAME = 'remotion-render-4-0-410-mem3008mb-disk2048mb-900sec';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId } = body;

        if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

        // Auth Check
        const { userId: clerkId, getToken } = await auth();
        // We allow checking status if unauthenticated? No, 'Users own jobs' policy blocks it.
        // We MUST be authenticated to read the job from video_jobs if RLS is on.

        let authClient = supabase;
        if (clerkId) {
            const token = await getToken({ template: 'supabase' }) || await getToken();
            if (token) authClient = createAuthenticatedClient(token);
        }

        // Fetch Job
        const { data: job, error: fetchError } = await authClient
            .from('video_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (fetchError || !job) {
            return NextResponse.json({ error: 'Job not found or access denied' }, { status: 404 });
        }

        // If already completed/failed, return result
        if (job.status === 'completed') {
            return NextResponse.json({
                done: true,
                videoUrl: job.output_url,
                status: 'completed'
            });
        }
        if (job.status === 'failed') {
            return NextResponse.json({
                done: true,
                error: job.error_message,
                status: 'failed'
            });
        }

        // If processing, check Remotion
        // We expect render details in result_data (from our start route)
        // Note: result_data is JSONB
        const renderData = job.result_data as any; // { renderId, bucketName, ... }

        if (!renderData || !renderData.renderId || !renderData.bucketName) {
            // Internal error: processing but no render info?
            return NextResponse.json({ error: 'Invalid job state: missing render info' }, { status: 500 });
        }

        console.log(`[Typography Status] Checking progress for ${jobId} (Render: ${renderData.renderId})`);

        const progress = await getRenderProgress({
            region: REMOTION_AWS_REGION as any,
            functionName: FUNCTION_NAME,
            bucketName: renderData.bucketName,
            renderId: renderData.renderId,
        });

        if (progress.done) {
            console.log('[Typography Status] Render complete!');
            const outputUrl = progress.outputFile || '';

            // Update Job to Completed
            const { error: updateError } = await authClient
                .from('video_jobs')
                .update({
                    status: 'completed',
                    progress: 100,
                    output_url: outputUrl,
                    progress_message: 'Render complete'
                })
                .eq('id', jobId);

            if (updateError) {
                console.error('[Typography Status] Failed to update job completion:', updateError);
            } else {
                console.log('[Typography Status] Job marked as completed in DB.');
            }

            // Note: The 'saveVideo' (inserting to public.videos) was typically done by Frontend upon receiving success.
            // We can rely on Frontend to call 'saveVideo' upon receiving done=true here.
            // OR we can do it here. 
            // 'Faceless' does it in backend. Typography used to rely on Frontend.
            // Let's keep relying on Frontend to trigger the saveVideo call to keep it simple,
            // OR frontend uses the returned videoUrl.

            return NextResponse.json({
                done: true,
                videoUrl: outputUrl,
                status: 'completed'
            });

        } else if (progress.fatalErrorEncountered) {
            console.error('[Typography Status] Fatal error:', progress.errors);
            const errorMsg = JSON.stringify(progress.errors);

            await authClient
                .from('video_jobs')
                .update({
                    status: 'failed',
                    error_message: errorMsg
                })
                .eq('id', jobId);

            return NextResponse.json({
                done: true,
                error: errorMsg,
                status: 'failed'
            });
        } else {
            // Still going
            const pct = Math.round((progress.overallProgress || 0) * 100);
            // Update progress in DB moderately (dont spam DB every poll)
            // Maybe every 10%?
            // Since client polls, we can just return status. 
            // Updating DB is good for persistent visibility.
            if (pct > (job.progress || 0) + 5) {
                await authClient
                    .from('video_jobs')
                    .update({
                        progress: pct,
                        progress_message: `Rendering: ${pct}%`
                    })
                    .eq('id', jobId);
            }

            return NextResponse.json({
                done: false,
                progress: pct,
                status: 'processing'
            });
        }

    } catch (e) {
        console.error('[Typography Status] Error:', e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
