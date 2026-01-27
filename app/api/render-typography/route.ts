import { NextRequest, NextResponse } from 'next/server';
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { supabase, getOrCreateUser, createAuthenticatedClient } from '@/lib/supabase';
import { auth, currentUser } from '@clerk/nextjs/server';

// Type definitions
interface WordTiming {
    word: string;
    start: number;
    end: number;
}

interface TypographyWord {
    text: string;
    startFrame: number;
    endFrame: number;
}

// Convert word timings (seconds) to frame-based timing for Remotion
function convertToFrameTimings(wordTimings: WordTiming[], fps: number = 30): TypographyWord[] {
    return wordTimings.map((wt, index) => {
        const startFrame = Math.max(0, Math.round(wt.start * fps));
        let endFrame = Math.max(0, Math.round(wt.end * fps));

        // Gap Filling: Extend this word to the next word's start, if the gap is small (< 1s)
        // This prevents the highlight from turning off during natural pauses, making it feel smoother/more synced.
        if (index < wordTimings.length - 1) {
            const nextStartFrame = Math.max(0, Math.round(wordTimings[index + 1].start * fps));
            const gap = nextStartFrame - endFrame;
            if (gap > 0 && gap < 30) { // If gap is less than 1 second (30 frames)
                endFrame = nextStartFrame;
            }
        }

        return {
            text: wt.word,
            startFrame,
            endFrame,
        };
    });
}

// Lambda configuration
const REMOTION_AWS_REGION = process.env.REMOTION_AWS_REGION || 'eu-north-1';
const FUNCTION_NAME = 'remotion-render-4-0-410-mem3008mb-disk2048mb-300sec'; // Upgraded to 3GB RAM
const SERVE_URL = 'https://remotionlambda-eunorth1-uzdpd4m8du.s3.eu-north-1.amazonaws.com/sites/typography-site-v6/index.html';
const BUCKET_NAME = 'remotionlambda-eunorth1-uzdpd4m8du'; // Hardcoded since getOrCreateBucket is not in client
export const maxDuration = 300; // Allow 5 minutes (though async return makes this less critical)

export async function POST(request: NextRequest) {
    const tempDir = path.join(os.tmpdir(), `typography-${Date.now()}`);
    let dbJobId: string | null = null; // Declare outside try for catch block access

    console.log('[Typography API] ===== REQUEST RECEIVED (ASYNC) =====');

    try {
        const body = await request.json();
        const {
            audioUrl,
            audioBase64,
            wordTimings,
            wordsPerGroup = 3,
            animationStyle = 'pop',
            aspectRatio = '9:16'
        } = body;

        // AUTH & DB SETUP
        const { userId: clerkId, getToken } = await auth();
        let authClient = supabase;

        if (clerkId) {
            // Get full user details to ensure reliable creation
            const clerkUser = await currentUser();
            const email = clerkUser?.emailAddresses[0]?.emailAddress || '';
            const name = clerkUser?.firstName || undefined;
            const imageUrl = clerkUser?.imageUrl || undefined;

            // Get Clerk Token for Supabase RLS
            // Try 'supabase' template, fallback to default
            let token = await getToken({ template: 'supabase' });
            if (!token) {
                console.log('[Typography API] Warning: No "supabase" template token, trying default...');
                token = await getToken();
            }

            if (token) {
                authClient = createAuthenticatedClient(token);
                console.log('[Typography API] Authenticated client created');
            } else {
                console.warn('[Typography API] Failed to get Clerk token - RLS may block DB ops');
            }

            const user = await getOrCreateUser(clerkId, email, name, imageUrl);
            if (user) {
                // Create Video Job using AUTHENTICATED client
                const { data: job, error: jobError } = await authClient
                    .from('video_jobs')
                    .insert({
                        user_id: user.id,
                        user_uuid: user.id, // REQUIRED for dashboard visibility
                        job_type: 'typography', // Explicitly set type to override default 'faceless'
                        status: 'processing',
                        input_data: {
                            jobType: 'typography',
                            audioUrl,
                            animationStyle,
                            aspectRatio,
                            wordCount: wordTimings?.length || 0
                        },
                        progress: 0,
                        progress_message: 'Starting typography render...'
                    })
                    .select()
                    .single();

                if (job) {
                    dbJobId = job.id;
                    console.log('[Typography API] Created DB Job:', dbJobId);
                } else if (jobError) {
                    console.error('[Typography API] Failed to create DB Job:', jobError);
                }
            } else {
                console.error('[Typography API] Failed to get/create Supabase user');
            }
        } else {
            console.warn('[Typography API] Unauthenticated request - no DB job will be created');
        }

        console.log('[Typography API] Body received:');
        console.log('[Typography API]   - audioUrl:', audioUrl ? 'present' : 'missing');
        console.log('[Typography API]   - audioBase64:', audioBase64 ? `${audioBase64.length} chars` : 'missing');
        console.log('[Typography API]   - wordTimings:', wordTimings?.length || 0, 'words');

        if (!wordTimings || wordTimings.length === 0) {
            console.log('[Typography API] ERROR: No word timings');
            return NextResponse.json({ error: 'Word timings are required' }, { status: 400 });
        }

        if (!audioUrl && !audioBase64) {
            console.log('[Typography API] ERROR: No audio');
            return NextResponse.json({ error: 'Audio (audioUrl or audioBase64) is required' }, { status: 400 });
        }

        console.log('[Typography API] Creating temp directory...');
        await fs.mkdir(tempDir, { recursive: true });

        // Upload audio to S3 if only base64 is provided
        let finalAudioUrl = audioUrl;

        if (audioBase64 && !audioUrl) {
            console.log('[Typography API] Uploading base64 audio to S3...');

            try {
                // 1. Use hardcoded bucket
                console.log('[Typography API] Using bucket:', BUCKET_NAME);

                // 2. Convert base64 to buffer
                const audioBuffer = Buffer.from(audioBase64, 'base64');
                const fileName = `typography-audio-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;

                // 3. Upload using AWS SDK directly for speed
                const s3Client = new S3Client({
                    region: REMOTION_AWS_REGION,
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
                    },
                });

                await s3Client.send(new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: fileName,
                    Body: audioBuffer,
                    ContentType: 'audio/mpeg',
                    ACL: 'public-read', // Make it accessible to Lambda
                }));

                finalAudioUrl = `https://${BUCKET_NAME}.s3.${REMOTION_AWS_REGION}.amazonaws.com/${fileName}`;
                console.log('[Typography API] Audio uploaded to S3:', finalAudioUrl);
            } catch (s3Error) {
                console.error('[Typography API] S3 Upload failed:', s3Error);
                // Fallback to data URL
                finalAudioUrl = `data:audio/mp3;base64,${audioBase64}`;
                console.warn('[Typography API] Falling back to data URL');
            }
        }

        // Determine dimensions
        let width = 1080;
        let height = 1920;
        if (aspectRatio === '16:9') {
            width = 1920;
            height = 1080;
        } else if (aspectRatio === '1:1') {
            width = 1080;
            height = 1080;
        }
        console.log('[Typography API] Dimensions:', width, 'x', height);

        const fps = 30;

        // Convert word timings to frame-based format
        const typographyWords = convertToFrameTimings(wordTimings, fps);
        console.log('[Typography API] Converted', typographyWords.length, 'words to frame timings');

        // Calculate total duration from last word
        const lastWord = typographyWords[typographyWords.length - 1];
        const durationInFrames = lastWord.endFrame + Math.floor(fps * 0.5);
        console.log('[Typography API] Duration in frames:', durationInFrames, '(', durationInFrames / fps, 's)');

        // Render on Lambda (Async Start)
        console.log('[Typography API] ===== CALLING LAMBDA (ASYNC) =====');
        console.log('[Typography API] Audio URL:', finalAudioUrl);

        // Increase framesPerLambda to reduce concurrency and avoid Rate Exceeded
        // 1048 frames / 600 = ~2 lambdas. Much safer than 80 (~13 lambdas).
        const FRAMES_PER_LAMBDA = 600;

        const renderResult = await renderMediaOnLambda({
            region: REMOTION_AWS_REGION as any,
            functionName: FUNCTION_NAME,
            serveUrl: SERVE_URL,
            composition: 'TypographyComposition',
            inputProps: {
                audioUrl: finalAudioUrl,
                words: typographyWords,
                wordsPerGroup,
                animationStyle,
            },
            codec: 'h264',
            framesPerLambda: FRAMES_PER_LAMBDA,
            privacy: 'public',
            downloadBehavior: {
                type: 'download',
                fileName: 'typography-video.mp4',
            },
        });

        console.log('[Typography API] ===== LAMBDA STARTED =====');
        console.log('[Typography API] Render ID:', renderResult.renderId);
        console.log('[Typography API] Bucket:', renderResult.bucketName);

        // Update DB Job with Render Details (so we can poll it)
        if (dbJobId) {
            console.log('[Typography API] Saving Render State to DB...');
            // Need to fetch fresh state to modify jsonb? No, insert overrides? No update updates.
            // We append to input_data or result_data.
            const { error: updateError } = await authClient
                .from('video_jobs')
                .update({
                    status: 'processing', // Still processing
                    progress: 10,
                    progress_message: 'Rendering started...',
                    // Store render details in result_data (or input, but result is cleaner for interim state?)
                    result_data: {
                        renderId: renderResult.renderId,
                        bucketName: renderResult.bucketName,
                        region: REMOTION_AWS_REGION,
                        functionName: FUNCTION_NAME
                    }
                })
                .eq('id', dbJobId);

            if (updateError) console.error('[Typography API] Failed to save render state:', updateError);
        }

        // Clean up temp dir immediately since we are not waiting
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }

        // Return immediately so client can poll
        return NextResponse.json({
            jobId: dbJobId,
            status: 'processing',
            renderId: renderResult.renderId,
            duration: durationInFrames / fps
        });

    } catch (error) {
        console.error('[Typography API] ===== ERROR =====');
        console.error('[Typography API] Error message:', error instanceof Error ? error.message : String(error));
        console.error('[Typography API] Full error:', error);

        // Cleanup temp dir
        try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { }

        // Update DB Job Failure
        if (dbJobId) {
            await supabase
                .from('video_jobs')
                .update({
                    status: 'failed',
                    error_message: error instanceof Error ? error.message : 'Unknown error'
                })
                .eq('id', dbJobId);
        }

        return NextResponse.json(
            { error: `Failed to start typography render: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
