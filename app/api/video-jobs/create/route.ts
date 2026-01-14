import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { auth } from '@clerk/nextjs/server';
import { getUserCredits, deductCredits } from '@/lib/supabase';
import { CREDIT_COSTS } from '@/lib/credits';

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

        // 2. Calculate credit cost based on job_type
        let creditCost = 0;
        let creditDescription = '';

        if (job_type === 'faceless') {
            // Faceless video: Number of scenes × 30 credits/scene + 80 render fee
            const sceneCount = input_data?.scenes?.length || 1;
            creditCost = (sceneCount * CREDIT_COSTS.AUDIO_PER_1000_CHARS) + CREDIT_COSTS.VIDEO_RENDER;
            creditDescription = `Faceless video (${sceneCount} scenes)`;
            console.log(`[video-jobs/create] Faceless video cost: ${sceneCount} scenes × ${CREDIT_COSTS.AUDIO_PER_1000_CHARS} + ${CREDIT_COSTS.VIDEO_RENDER} render = ${creditCost} credits`);
        } else if (job_type === 'face') {
            // Face video: Face scenes × 100 credits/scene + 80 render fee
            const faceSceneCount = input_data?.scenes?.length || 1;
            creditCost = (faceSceneCount * CREDIT_COSTS.FACE_VIDEO_SCENE) + CREDIT_COSTS.VIDEO_RENDER;
            creditDescription = `Face video (${faceSceneCount} scenes)`;
            console.log(`[video-jobs/create] Face video cost: ${faceSceneCount} scenes × 100 + 80 render = ${creditCost} credits`);
        } else {
            // Unknown job type - no credits charged but log warning
            console.warn(`[video-jobs/create] Unknown job_type: ${job_type}, no credits charged`);
        }

        // 3. Check if user has enough credits
        if (creditCost > 0) {
            const creditsData = await getUserCredits(clerkUserId);
            const userCredits = creditsData?.balance ?? 0;
            console.log(`[video-jobs/create] User ${clerkUserId} has ${userCredits} credits, needs ${creditCost}`);

            if (userCredits < creditCost) {
                console.log(`[video-jobs/create] Insufficient credits: ${userCredits} < ${creditCost}`);
                return NextResponse.json({
                    error: 'Insufficient credits',
                    required: creditCost,
                    available: userCredits
                }, { status: 402 });
            }

            // 4. Deduct credits BEFORE creating job
            console.log(`[video-jobs/create] Deducting ${creditCost} credits for: ${creditDescription}`);
            const deductResult = await deductCredits(clerkUserId, creditCost, creditDescription);
            console.log(`[video-jobs/create] Credit deduction result:`, JSON.stringify(deductResult));

            if (!deductResult.success) {
                console.error(`[video-jobs/create] Credit deduction failed:`, deductResult.error);
                return NextResponse.json({
                    error: 'Failed to deduct credits',
                    details: deductResult.error
                }, { status: 500 });
            }
        }

        // 5. Insert the job as Admin (bypassing RLS)
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
            // Note: Credits already deducted - consider refund logic in production
            return NextResponse.json({ error: 'Failed to create job', details: insertError }, { status: 400 });
        }

        console.log(`[video-jobs/create] Job created successfully: ${job.id}, charged ${creditCost} credits`);
        return NextResponse.json({ job, creditsCharged: creditCost });
    } catch (e: any) {
        console.error('Server error creating job:', e);
        return NextResponse.json({ error: 'Internal Server Error', details: e.message }, { status: 500 });
    }
}
