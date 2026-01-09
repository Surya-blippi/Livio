import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface SceneInput {
    text: string;
    type: 'face' | 'asset';
    assetUrl?: string;
}

interface StartJobRequest {
    scenes: SceneInput[];
    faceImageUrl: string;
    voiceId: string;
    enableBackgroundMusic?: boolean;
    enableCaptions?: boolean;
    userId?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as StartJobRequest;
        const { scenes, faceImageUrl, voiceId, enableBackgroundMusic, enableCaptions, userId } = body;

        // Validate required fields
        if (!scenes || scenes.length === 0 || !faceImageUrl || !voiceId) {
            return NextResponse.json(
                { error: 'Missing required fields: scenes, faceImageUrl, voiceId' },
                { status: 400 }
            );
        }

        console.log('📝 Creating face video job...');
        console.log(`   Scenes: ${scenes.length}`);
        console.log(`   Face scenes: ${scenes.filter(s => s.type === 'face').length}`);
        console.log(`   Asset scenes: ${scenes.filter(s => s.type === 'asset').length}`);

        // Create job in Supabase
        const { data: job, error } = await supabase
            .from('video_jobs')
            .insert({
                user_id: userId || 'anonymous',
                status: 'pending',
                input_data: {
                    scenes,
                    faceImageUrl,
                    voiceId,
                    enableBackgroundMusic: enableBackgroundMusic ?? false,
                    enableCaptions: enableCaptions ?? true
                },
                progress: 0,
                progress_message: 'Job created, starting processing...'
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to create job:', error);
            return NextResponse.json(
                { error: 'Failed to create video job' },
                { status: 500 }
            );
        }

        console.log(`✅ Job created: ${job.id}`);

        // Trigger processing asynchronously (fire and forget)
        // The process endpoint will pick up this job
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
        fetch(`${baseUrl}/api/face-video/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: job.id })
        }).catch(err => {
            console.log('Process trigger sent (async):', err ? 'with warning' : 'ok');
        });

        // Return immediately with job ID
        return NextResponse.json({
            jobId: job.id,
            status: 'pending',
            message: 'Video generation started'
        });

    } catch (error) {
        console.error('Error starting face video job:', error);
        return NextResponse.json(
            { error: `Failed to start video job: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
