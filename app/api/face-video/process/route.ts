import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { fal } from '@fal-ai/client';
import { supabase } from '@/lib/supabase';
import { convertFaceVideoToJson2VideoFormat, FaceSceneInput } from '@/lib/json2video';

// Reasonable timeout - we start scenes and optionally poll
export const maxDuration = 55;

// Configuration
const LOCK_TIMEOUT_MS = 120000; // 2 minutes stale lock timeout
const SCENE_TIMEOUT_MS = 600000; // 10 minutes per scene timeout
const POLL_INTERVAL_MS = 5000; // 5 seconds between polls
const MAX_POLL_TIME_MS = 45000; // 45 seconds max polling per API call

fal.config({
    credentials: process.env.FAL_KEY
});

const WAVESPEED_API_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk';
const WAVESPEED_API_KEY = process.env.NEXT_PUBLIC_WAVESPEED_API_KEY!;
const JSON2VIDEO_API_KEY = process.env.JSON2VIDEO_API_KEY!;

interface SceneInput {
    text: string;
    type: 'face' | 'asset';
    assetUrl?: string;
}

interface ProcessedScene {
    index: number;
    type: 'face' | 'asset';
    clipUrl: string;
    audioUrl?: string;
    duration: number;
    text: string;
}

// Pending scene state - stored in input_data JSONB
interface PendingSceneState {
    predictionId: string;
    sceneIndex: number;
    audioUrl: string;
    duration: number;
    text: string;
    startedAt: number;
}

// Job input data structure
interface JobInputData {
    scenes: SceneInput[];
    faceImageUrl: string;
    voiceId: string;
    enableBackgroundMusic: boolean;
    enableCaptions: boolean;
    pendingScene?: PendingSceneState | null;
}

// Update job in Supabase
async function updateJob(jobId: string, updates: Record<string, unknown>) {
    const result = await supabase
        .from('video_jobs')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

    if (result.error) {
        console.error('Failed to update job:', result.error);
    }
    return result;
}

// Generate TTS for a single scene
async function generateSceneTTS(text: string, voiceId: string): Promise<{ audioUrl: string; duration: number }> {
    const result = await fal.subscribe('fal-ai/minimax/speech-02-hd', {
        input: {
            text,
            voice_setting: {
                voice_id: voiceId,
                speed: 1,
                vol: 1,
                pitch: 0
            },
            output_format: 'url'
        },
        logs: false
    }) as unknown as { data: { audio: { url: string }; duration_ms?: number } };

    if (!result.data?.audio?.url) {
        throw new Error('No audio URL returned from TTS API');
    }

    return {
        audioUrl: result.data.audio.url,
        duration: (result.data.duration_ms || 5000) / 1000
    };
}

// Check if we have a valid public webhook URL
function getWebhookUrl(request: NextRequest): string | null {
    // Only use webhook if we have a proper public URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const vercelUrl = process.env.VERCEL_URL;

    if (appUrl && !appUrl.includes('localhost')) {
        return `${appUrl}/api/face-video/webhook`;
    }

    if (vercelUrl) {
        return `https://${vercelUrl}/api/face-video/webhook`;
    }

    // Check request origin - if it's not localhost, use it
    const origin = request.nextUrl.origin;
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return `${origin}/api/face-video/webhook`;
    }

    // No valid public URL - will use polling instead
    console.log('⚠️ No public webhook URL available, will use polling');
    return null;
}

// Start WaveSpeed face video generation
async function startFaceVideoGeneration(
    imageDataUrl: string,
    audioUrl: string,
    webhookUrl: string | null
): Promise<string> {
    // Download audio and convert to base64
    const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const audioBase64 = Buffer.from(audioResponse.data).toString('base64');
    const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

    // Build URL - add webhook if available
    let requestUrl = WAVESPEED_API_URL;
    if (webhookUrl) {
        requestUrl = `${WAVESPEED_API_URL}?webhook=${encodeURIComponent(webhookUrl)}`;
        console.log(`🚀 Starting WaveSpeed with webhook: ${webhookUrl}`);
    } else {
        console.log(`🚀 Starting WaveSpeed (polling mode)`);
    }

    const response = await axios.post(
        requestUrl,
        {
            image: imageDataUrl,
            audio: audioDataUrl,
            resolution: '480p', // Use 480p for cost savings ($0.15/5s vs $0.30/5s)
            seed: -1
        },
        {
            headers: {
                'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        }
    );

    const responseData = response.data.data || response.data;
    console.log(`📋 WaveSpeed response:`, { id: responseData.id, status: responseData.status });
    return responseData.id;
}

// Poll WaveSpeed for completion (backup/fallback mechanism)
async function pollWaveSpeedResult(predictionId: string): Promise<{ completed: boolean; videoUrl?: string; failed?: boolean }> {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_POLL_TIME_MS) {
        try {
            const pollUrl = `https://api.wavespeed.ai/api/v3/predictions/${predictionId}/result`;
            const pollResponse = await axios.get(pollUrl, {
                headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
                timeout: 10000
            });

            const pollData = pollResponse.data.data || pollResponse.data;
            console.log(`📊 WaveSpeed poll: status=${pollData.status}`);

            if (pollData.status === 'completed' && pollData.output?.video) {
                return { completed: true, videoUrl: pollData.output.video };
            } else if (pollData.status === 'failed') {
                console.error('❌ WaveSpeed generation failed');
                return { completed: false, failed: true };
            }

            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        } catch (pollError) {
            console.log(`⚠️ Poll error (will retry):`, pollError instanceof Error ? pollError.message : 'Unknown');
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    }

    return { completed: false };
}

// Upload video to Supabase Storage
async function uploadClipToSupabase(videoUrl: string, fileName: string): Promise<string> {
    try {
        console.log(`📤 Uploading video to Supabase: ${fileName}`);
        const response = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 60000 });
        const videoBuffer = Buffer.from(response.data);

        const { error } = await supabase.storage
            .from('videos')
            .upload(`clips/${fileName}`, videoBuffer, {
                contentType: 'video/mp4',
                upsert: true
            });

        if (error) {
            console.warn('⚠️ Supabase upload warning:', error);
            return videoUrl;
        }

        const { data: publicUrl } = supabase.storage
            .from('videos')
            .getPublicUrl(`clips/${fileName}`);

        console.log(`✅ Uploaded to Supabase`);
        return publicUrl.publicUrl;
    } catch (err) {
        console.error('❌ Upload failed:', err);
        return videoUrl;
    }
}

// Render with JSON2Video
async function renderWithJson2Video(moviePayload: Record<string, unknown>): Promise<{ videoUrl: string; duration: number }> {
    const response = await axios.post(
        'https://api.json2video.com/v2/movies',
        moviePayload,
        {
            headers: {
                'x-api-key': JSON2VIDEO_API_KEY,
                'Content-Type': 'application/json'
            }
        }
    );

    const projectId = response.data.project;
    const maxPolls = 60;

    for (let i = 0; i < maxPolls; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statusResponse = await axios.get(
            `https://api.json2video.com/v2/movies?project=${projectId}`,
            { headers: { 'x-api-key': JSON2VIDEO_API_KEY } }
        );

        const status = statusResponse.data;
        if (status.status === 'done' && status.movie) {
            return { videoUrl: status.movie, duration: status.duration || 30 };
        } else if (status.status === 'error') {
            throw new Error(`JSON2Video error: ${status.message}`);
        }
    }

    throw new Error('JSON2Video render timed out');
}

// Prepare face image as data URL
async function prepareFaceImageDataUrl(faceImageUrl: string): Promise<string> {
    if (faceImageUrl.startsWith('data:')) {
        return faceImageUrl;
    }
    const imgResponse = await axios.get(faceImageUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const imgBase64 = Buffer.from(imgResponse.data).toString('base64');
    const mimeType = imgResponse.headers['content-type'] || 'image/jpeg';
    return `data:${mimeType};base64,${imgBase64}`;
}

export async function POST(request: NextRequest) {
    let jobId: string | null = null;

    try {
        const { jobId: requestedJobId } = await request.json();
        jobId = requestedJobId;

        if (!jobId) {
            return NextResponse.json({ error: 'Missing job ID' }, { status: 400 });
        }

        // Fetch job from Supabase
        const { data: job, error: fetchError } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (fetchError || !job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        // Skip if already completed or failed
        if (job.status === 'completed' || job.status === 'failed') {
            return NextResponse.json({
                message: `Job already ${job.status}`,
                status: job.status
            });
        }

        // MUTEX: Check for stale locks
        if (job.is_processing === true) {
            const updatedAt = new Date(job.updated_at).getTime();
            const lockAge = Date.now() - updatedAt;

            if (lockAge < LOCK_TIMEOUT_MS) {
                console.log(`⏳ Job ${jobId} is locked (age: ${Math.round(lockAge / 1000)}s), skipping...`);
                return NextResponse.json({
                    message: 'Another process is currently running',
                    status: 'processing',
                    skipped: true
                });
            }
            console.log(`🔓 Force releasing stale lock (age: ${Math.round(lockAge / 1000)}s)`);
        }

        // Acquire lock
        await updateJob(jobId, { is_processing: true });

        const inputData = job.input_data as JobInputData;
        const { scenes, faceImageUrl, voiceId, enableBackgroundMusic, enableCaptions, pendingScene } = inputData;

        const totalScenes = scenes.length;
        const currentIndex = job.current_scene_index || 0;
        const processedScenes: ProcessedScene[] = job.processed_scenes || [];

        console.log(`🎬 Processing job ${jobId}: scene ${currentIndex + 1}/${totalScenes}, pending: ${pendingScene ? 'yes' : 'no'}`);

        // ============ Check pending scene (poll for completion) ============
        if (pendingScene && pendingScene.sceneIndex === currentIndex) {
            const sceneAge = Date.now() - pendingScene.startedAt;
            console.log(`📍 Checking pending scene ${currentIndex + 1} (age: ${Math.round(sceneAge / 1000)}s)...`);

            // Check for timeout
            if (sceneAge > SCENE_TIMEOUT_MS) {
                console.log(`⏰ Scene timed out, retrying...`);
                const updatedInputData = { ...inputData, pendingScene: null };
                await updateJob(jobId, {
                    input_data: updatedInputData,
                    progress_message: `Scene ${currentIndex + 1} timed out, retrying...`,
                    is_processing: false
                });
                return NextResponse.json({ success: true, retry: true });
            }

            // Poll for completion (backup in case webhook fails)
            const pollResult = await pollWaveSpeedResult(pendingScene.predictionId);

            if (pollResult.failed) {
                console.log(`❌ WaveSpeed failed, will retry`);
                const updatedInputData = { ...inputData, pendingScene: null };
                await updateJob(jobId, {
                    input_data: updatedInputData,
                    progress_message: `Scene ${currentIndex + 1} failed, retrying...`,
                    is_processing: false
                });
                return NextResponse.json({ success: true, retry: true });
            }

            if (pollResult.completed && pollResult.videoUrl) {
                console.log(`✅ WaveSpeed completed for scene ${currentIndex + 1}!`);

                const fileName = `clip_${jobId}_scene_${currentIndex}.mp4`;
                const clipUrl = await uploadClipToSupabase(pollResult.videoUrl, fileName);

                const newProcessedScene: ProcessedScene = {
                    index: currentIndex,
                    type: 'face',
                    clipUrl,
                    duration: pendingScene.duration,
                    text: pendingScene.text
                };

                processedScenes.push(newProcessedScene);

                const updatedInputData = { ...inputData, pendingScene: null };
                await updateJob(jobId, {
                    current_scene_index: currentIndex + 1,
                    processed_scenes: processedScenes,
                    input_data: updatedInputData,
                    progress: Math.floor(10 + ((currentIndex + 1) / totalScenes) * 70),
                    progress_message: `Scene ${currentIndex + 1}/${totalScenes} complete`,
                    is_processing: false
                });

                console.log(`✅ Scene ${currentIndex + 1} saved. Next: ${currentIndex + 2}/${totalScenes}`);
                return NextResponse.json({
                    success: true,
                    currentScene: currentIndex + 1,
                    totalScenes
                });
            }

            // Still processing - release lock and wait
            console.log(`⏳ Scene still generating...`);
            await updateJob(jobId, {
                progress_message: `Generating face video ${currentIndex + 1}/${totalScenes}...`,
                is_processing: false
            });
            return NextResponse.json({
                success: true,
                message: 'Still generating, poll again',
                waitingForCompletion: true
            });
        }

        // ============ All scenes processed - compose ============
        if (currentIndex >= totalScenes) {
            console.log(`📽️ All scenes processed, composing...`);

            await updateJob(jobId, { progress: 80, progress_message: 'Composing final video...' });

            const faceScenes: FaceSceneInput[] = processedScenes.map(ps => ({
                url: ps.clipUrl,
                duration: ps.duration,
                text: ps.text,
                sceneType: ps.type,
                audioUrl: ps.audioUrl
            }));

            const moviePayload = convertFaceVideoToJson2VideoFormat({
                scenes: faceScenes,
                enableCaptions: enableCaptions ?? true,
                captionStyle: 'bold-classic',
                enableBackgroundMusic: enableBackgroundMusic ?? false,
            });

            await updateJob(jobId, { progress: 85, progress_message: 'Rendering final video...' });

            const { videoUrl, duration } = await renderWithJson2Video(moviePayload);

            const clipAssets = processedScenes
                .filter(ps => ps.type === 'face')
                .map(ps => ({ url: ps.clipUrl, source: 'wavespeed' }));

            await updateJob(jobId, {
                status: 'completed',
                progress: 100,
                progress_message: 'Video ready!',
                result_data: { videoUrl, duration, clipAssets },
                is_processing: false
            });

            console.log(`✅ Job ${jobId} completed!`);
            return NextResponse.json({ success: true, completed: true, videoUrl, duration });
        }

        // ============ Start new scene ============
        await updateJob(jobId, {
            status: 'processing',
            progress: Math.floor(10 + (currentIndex / totalScenes) * 70),
            progress_message: `Processing scene ${currentIndex + 1}/${totalScenes}...`
        });

        const scene = scenes[currentIndex];
        console.log(`📍 Starting scene ${currentIndex + 1}: ${scene.type.toUpperCase()}`);

        const { audioUrl, duration } = await generateSceneTTS(scene.text, voiceId);
        console.log(`🔊 TTS: ${duration.toFixed(1)}s`);

        if (scene.type === 'face') {
            const imageDataUrl = await prepareFaceImageDataUrl(faceImageUrl);
            const webhookUrl = getWebhookUrl(request);

            const predictionId = await startFaceVideoGeneration(imageDataUrl, audioUrl, webhookUrl);
            console.log(`🚀 WaveSpeed started: ${predictionId}`);

            const newPendingScene: PendingSceneState = {
                predictionId,
                sceneIndex: currentIndex,
                audioUrl,
                duration,
                text: scene.text,
                startedAt: Date.now()
            };

            await updateJob(jobId, {
                input_data: { ...inputData, pendingScene: newPendingScene },
                progress_message: `Generating face video ${currentIndex + 1}/${totalScenes}...`,
                is_processing: false
            });

            return NextResponse.json({
                success: true,
                message: `Scene ${currentIndex + 1} started`,
                waitingForCompletion: true
            });
        } else {
            // Asset scene
            const newProcessedScene: ProcessedScene = {
                index: currentIndex,
                type: scene.type,
                clipUrl: scene.assetUrl || faceImageUrl,
                audioUrl: audioUrl,
                duration,
                text: scene.text
            };

            processedScenes.push(newProcessedScene);

            await updateJob(jobId, {
                current_scene_index: currentIndex + 1,
                processed_scenes: processedScenes,
                progress: Math.floor(10 + ((currentIndex + 1) / totalScenes) * 70),
                progress_message: `Scene ${currentIndex + 1}/${totalScenes} complete`,
                is_processing: false
            });

            console.log(`✅ Asset scene ${currentIndex + 1} complete`);
            return NextResponse.json({ success: true, currentScene: currentIndex + 1, totalScenes });
        }

    } catch (error) {
        console.error('❌ Error:', error);

        if (jobId) {
            await updateJob(jobId, {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                progress_message: 'Failed',
                is_processing: false
            });
        }

        return NextResponse.json(
            { error: `Failed: ${error instanceof Error ? error.message : 'Unknown'}` },
            { status: 500 }
        );
    }
}
