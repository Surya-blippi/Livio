import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface SceneTiming {
    text: string;
    startTime: number;
    endTime: number;
}

interface WordTiming {
    word: string;
    startTime: number;
    endTime: number;
}

interface StartJobRequest {
    remoteAudioUrl: string;
    wordTimings: WordTiming[];
    duration: number;
    sceneTimings?: SceneTiming[];
    images: string[];
    aspectRatio: '9:16' | '16:9' | '1:1';
    captionStyle?: string;
    enableBackgroundMusic?: boolean;
    enableCaptions?: boolean;
    backgroundMusicUrl?: string;
    userId?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as StartJobRequest;
        const {
            remoteAudioUrl,
            wordTimings,
            duration,
            sceneTimings,
            images,
            aspectRatio,
            captionStyle,
            enableBackgroundMusic,
            enableCaptions,
            backgroundMusicUrl,
            userId
        } = body;

        // Validate required fields
        if (!remoteAudioUrl || !images || images.length === 0) {
            return NextResponse.json(
                { error: 'Missing required fields: remoteAudioUrl, images' },
                { status: 400 }
            );
        }

        console.log('📝 Creating faceless video job...');
        console.log(`   Images: ${images.length}`);
        console.log(`   Duration: ${duration}s`);
        console.log(`   Aspect ratio: ${aspectRatio}`);

        // Create job in Supabase
        const { data: job, error } = await supabase
            .from('video_jobs')
            .insert({
                user_id: userId || 'anonymous',
                job_type: 'faceless',
                status: 'pending',
                input_data: {
                    remoteAudioUrl,
                    wordTimings,
                    duration,
                    sceneTimings,
                    images,
                    aspectRatio,
                    captionStyle: captionStyle ?? 'bold-classic',
                    enableBackgroundMusic: enableBackgroundMusic ?? false,
                    enableCaptions: enableCaptions ?? true,
                    backgroundMusicUrl
                },
                progress: 0,
                progress_message: 'Job created, starting processing...'
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to create faceless job:', error);
            return NextResponse.json(
                { error: 'Failed to create video job' },
                { status: 500 }
            );
        }

        console.log(`✅ Faceless job created: ${job.id}`);

        // Trigger processing asynchronously (fire and forget)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
        fetch(`${baseUrl}/api/faceless-video/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: job.id })
        }).catch(err => {
            console.log('Faceless process trigger sent (async):', err ? 'with warning' : 'ok');
        });

        // Return immediately with job ID
        return NextResponse.json({
            jobId: job.id,
            status: 'pending',
            message: 'Faceless video generation started'
        });

    } catch (error) {
        console.error('Error starting faceless video job:', error);
        return NextResponse.json(
            { error: `Failed to start video job: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
