import { NextRequest, NextResponse } from 'next/server';
import { supabase, getOrCreateUser, hasEnoughCredits, deductCredits } from '@/lib/supabase';
import { auth, currentUser } from '@clerk/nextjs/server';
import { estimateTotalCredits } from '@/lib/credits';

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

interface FacelessSceneInput {
    text: string;
    assetUrl: string;
    assetType?: 'image' | 'video';
}

interface StartJobRequest {
    scenes: FacelessSceneInput[];
    voiceId: string;
    aspectRatio: '9:16' | '16:9' | '1:1';
    captionStyle?: string;
    enableBackgroundMusic?: boolean;
    enableCaptions?: boolean;
    backgroundMusicUrl?: string;
    userId?: string;
}

export async function POST(request: NextRequest) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json() as StartJobRequest;
        const {
            scenes,
            voiceId,
            aspectRatio,
            captionStyle,
            enableBackgroundMusic,
            enableCaptions,
            backgroundMusicUrl,
            userId: providedUserId // Warning: Don't trust this if passed from client, use auth
        } = body;

        // Validate required fields
        if (!scenes || scenes.length === 0) {
            return NextResponse.json(
                { error: 'Missing required fields: scenes' },
                { status: 400 }
            );
        }

        // 1. Get user and check credits
        const currentUserData = await currentUser();
        const user = await getOrCreateUser(
            clerkId,
            currentUserData?.emailAddresses[0]?.emailAddress || '',
            currentUserData?.firstName || undefined,
            currentUserData?.imageUrl || undefined
        );

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Calculate cost based on script length (audio gen) + fixed render cost
        const scriptCharCount = scenes.reduce((acc, scene) => acc + (scene.text?.length || 0), 0);
        const cost = estimateTotalCredits({
            mode: 'faceless',
            scriptCharCount
        });

        const hasCredits = await hasEnoughCredits(user.id, cost);

        if (!hasCredits) {
            return NextResponse.json({
                error: `Insufficient credits. This video requires ${cost} credits.`,
                code: 'INSUFFICIENT_CREDITS'
            }, { status: 402 });
        }

        console.log('📝 Creating faceless video job...');
        console.log(`   Scenes: ${scenes.length}`);
        console.log(`   Script Stats: ${scriptCharCount} chars`);
        console.log(`   Est. Cost: ${cost} credits`);
        console.log(`   Aspect ratio: ${aspectRatio}`);

        // Create job in Supabase
        const { data: job, error } = await supabase
            .from('video_jobs')
            .insert({
                user_id: user.id, // Use authenticated user ID
                status: 'pending',
                input_data: {
                    jobType: 'faceless', // Store job type in input_data
                    scenes,
                    voiceId,
                    aspectRatio,
                    captionStyle: captionStyle ?? 'bold-classic',
                    enableBackgroundMusic: enableBackgroundMusic ?? false,
                    enableCaptions: enableCaptions ?? true,
                    backgroundMusicUrl,
                    cost // Persist cost for reference
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

        // Deduct credits immediately
        const deductResult = await deductCredits(user.id, cost, 'Faceless Video Generation', {
            jobId: job.id,
            sceneCount: scenes.length,
            charCount: scriptCharCount
        });

        console.log(`[faceless-video/start] Credit deduction result:`, deductResult);
        if (!deductResult.success) {
            console.error(`[faceless-video/start] ⚠️ Credit deduction failed:`, deductResult.error);
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
