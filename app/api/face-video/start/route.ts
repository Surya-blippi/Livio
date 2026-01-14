import { NextRequest, NextResponse } from 'next/server';
import { supabase, getOrCreateUser, hasEnoughCredits, deductCredits } from '@/lib/supabase';
import { auth, currentUser } from '@clerk/nextjs/server';
import { estimateTotalCredits } from '@/lib/credits';

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
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json() as StartJobRequest;
        const { scenes, faceImageUrl, voiceId, enableBackgroundMusic, enableCaptions, userId: providedUserId } = body;

        // Validate required fields
        if (!scenes || scenes.length === 0 || !faceImageUrl || !voiceId) {
            return NextResponse.json(
                { error: 'Missing required fields: scenes, faceImageUrl, voiceId' },
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

        // Calculate cost based on Face scenes only (or typical logic)
        // If 'face' scene count > 0, we charge for those.
        const faceSceneCount = scenes.filter(s => s.type === 'face').length;
        const cost = estimateTotalCredits({
            mode: 'face',
            scriptCharCount: 0, // Not used for face mode calculation currently
            sceneCount: faceSceneCount
        });

        const hasCredits = await hasEnoughCredits(user.id, cost);

        if (!hasCredits) {
            return NextResponse.json({
                error: `Insufficient credits. This video requires ${cost} credits.`,
                code: 'INSUFFICIENT_CREDITS'
            }, { status: 402 });
        }

        console.log('📝 Creating face video job...');
        console.log(`   Scenes: ${scenes.length}`);
        console.log(`   Face scenes: ${faceSceneCount}`);
        console.log(`   Est. Cost: ${cost} credits`);
        console.log(`   Asset scenes: ${scenes.filter(s => s.type === 'asset').length}`);

        // Create job in Supabase
        const { data: job, error } = await supabase
            .from('video_jobs')
            .insert({
                user_id: user.id, // Use authenticated user ID
                status: 'pending',
                input_data: {
                    scenes,
                    faceImageUrl,
                    voiceId,
                    enableBackgroundMusic: enableBackgroundMusic ?? false,
                    enableCaptions: enableCaptions ?? true,
                    cost // Persist cost
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

        // Deduct credits immediately
        await deductCredits(user.id, cost, 'Face Video Generation', {
            jobId: job.id,
            sceneCount: faceSceneCount,
            totalScenes: scenes.length
        });

        console.log(`✅ Job created: ${job.id}`);

        // Trigger processing asynchronously (fire and forget)
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
