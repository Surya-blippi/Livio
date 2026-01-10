import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { fal } from '@fal-ai/client';
import { supabase } from '@/lib/supabase';
import { convertFaceVideoToJson2VideoFormat, FaceSceneInput } from '@/lib/json2video';

// Configure for Vercel Hobby plan safe timeout (60s max, using 55s for safety margin)
export const maxDuration = 55;

// Timeouts and polling configuration
const QUICK_POLL_TIMEOUT_MS = 25000; // 25 seconds per API call for polling (safe margin)
const POLL_INTERVAL_MS = 3000; // 3 seconds between polls

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

// Pending scene state - tracks WaveSpeed jobs in progress
interface PendingSceneState {
    predictionId: string;
    sceneIndex: number;
    audioUrl: string;
    duration: number;
    text: string;
    imageDataUrl: string;
}

// Update job in Supabase
async function updateJob(jobId: string, updates: Record<string, unknown>) {
    await supabase
        .from('video_jobs')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
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

// Start WaveSpeed face video generation - returns prediction ID immediately
async function startFaceVideoGeneration(imageDataUrl: string, audioUrl: string): Promise<string> {
    // Download audio and convert to base64
    const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const audioBase64 = Buffer.from(audioResponse.data).toString('base64');
    const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

    // Create video using WaveSpeed API
    const response = await axios.post(
        WAVESPEED_API_URL,
        {
            image: imageDataUrl,
            audio: audioDataUrl,
            resolution: '720p',
            seed: -1
        },
        {
            headers: {
                'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 20000
        }
    );

    const responseData = response.data.data || response.data;
    return responseData.id;
}

// Quick poll for WaveSpeed completion - limited time per API call
async function quickPollWaveSpeed(predictionId: string): Promise<{ completed: boolean; videoUrl?: string }> {
    const startTime = Date.now();

    while (Date.now() - startTime < QUICK_POLL_TIMEOUT_MS) {
        try {
            const pollUrl = `https://api.wavespeed.ai/api/v3/predictions/${predictionId}/result`;
            const pollResponse = await axios.get(pollUrl, {
                headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
                timeout: 10000
            });

            const pollData = pollResponse.data.data || pollResponse.data;

            if (pollData.status === 'completed' && pollData.output?.video) {
                return { completed: true, videoUrl: pollData.output.video };
            } else if (pollData.status === 'failed') {
                throw new Error('WaveSpeed video generation failed');
            }

            // Continue polling
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        } catch (pollError) {
            // Only throw if it's a known failure, otherwise continue polling
            if (axios.isAxiosError(pollError) && pollError.response?.status === 404) {
                // Prediction not found - might still be starting
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
            } else if (pollError instanceof Error && pollError.message.includes('failed')) {
                throw pollError;
            } else {
                // Timeout or network error - continue polling
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
            }
        }
    }

    // Time's up for this API call - return incomplete
    return { completed: false };
}

// Upload video to Supabase Storage
async function uploadClipToSupabase(videoUrl: string, fileName: string): Promise<string> {
    try {
        const response = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const videoBuffer = Buffer.from(response.data);

        const { error } = await supabase.storage
            .from('videos')
            .upload(`clips/${fileName}`, videoBuffer, {
                contentType: 'video/mp4',
                upsert: true
            });

        if (error) {
            console.warn('Supabase upload warning:', error);
            return videoUrl;
        }

        const { data: publicUrl } = supabase.storage
            .from('videos')
            .getPublicUrl(`clips/${fileName}`);

        return publicUrl.publicUrl;
    } catch {
        return videoUrl; // Fallback to original URL
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
    const maxPolls = 24; // 24 * 5s = 2 minutes

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

        // MUTEX: Check if another process call is currently running
        if (job.is_processing === true) {
            console.log(`⏳ Job ${jobId} is already being processed by another call, skipping...`);
            return NextResponse.json({
                message: 'Another process is currently running',
                status: 'processing',
                skipped: true
            });
        }

        // Acquire the lock immediately
        await updateJob(jobId, { is_processing: true });

        const { scenes, faceImageUrl, voiceId, enableBackgroundMusic, enableCaptions } = job.input_data as {
            scenes: SceneInput[];
            faceImageUrl: string;
            voiceId: string;
            enableBackgroundMusic: boolean;
            enableCaptions: boolean;
        };

        const totalScenes = scenes.length;
        const currentIndex = job.current_scene_index || 0;
        const processedScenes: ProcessedScene[] = job.processed_scenes || [];
        const pendingScene: PendingSceneState | null = job.pending_scene || null;

        console.log(`🎬 Processing job ${jobId}: scene ${currentIndex + 1}/${totalScenes}, pending: ${pendingScene ? 'yes' : 'no'}`);

        // ============ PHASE 2: Check pending WaveSpeed scene ============
        if (pendingScene && pendingScene.sceneIndex === currentIndex) {
            console.log(`📍 Checking pending WaveSpeed scene ${currentIndex + 1}...`);

            await updateJob(jobId, {
                progress_message: `Waiting for face video ${currentIndex + 1}/${totalScenes}...`
            });

            const pollResult = await quickPollWaveSpeed(pendingScene.predictionId);

            if (pollResult.completed && pollResult.videoUrl) {
                console.log(`✅ WaveSpeed scene ${currentIndex + 1} completed!`);

                // Upload and save the scene
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

                // Clear pending scene and move to next
                await updateJob(jobId, {
                    current_scene_index: currentIndex + 1,
                    processed_scenes: processedScenes,
                    pending_scene: null,
                    progress: Math.floor(10 + ((currentIndex + 1) / totalScenes) * 70),
                    progress_message: `Scene ${currentIndex + 1}/${totalScenes} complete`,
                    is_processing: false
                });

                console.log(`✅ Scene ${currentIndex + 1} saved. Next: ${currentIndex + 2}/${totalScenes}`);

                return NextResponse.json({
                    success: true,
                    completed: false,
                    currentScene: currentIndex + 1,
                    totalScenes,
                    message: `Scene ${currentIndex + 1}/${totalScenes} processed`
                });
            } else {
                // Still processing - release lock and return
                console.log(`⏳ WaveSpeed scene ${currentIndex + 1} still processing...`);

                await updateJob(jobId, {
                    progress_message: `Generating face video ${currentIndex + 1}/${totalScenes} (processing...)`,
                    is_processing: false
                });

                return NextResponse.json({
                    success: true,
                    completed: false,
                    currentScene: currentIndex,
                    totalScenes,
                    message: `Scene ${currentIndex + 1} still generating, check again soon`,
                    pendingWaveSpeed: true
                });
            }
        }

        // ============ Check if all scenes are processed ============
        if (currentIndex >= totalScenes) {
            // Move to composition phase
            await updateJob(jobId, {
                status: 'processing',
                progress: 80,
                progress_message: 'Composing final video...'
            });

            // Build JSON2Video payload from processed scenes
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

            await updateJob(jobId, {
                progress: 85,
                progress_message: 'Rendering with JSON2Video...'
            });

            const { videoUrl, duration } = await renderWithJson2Video(moviePayload);

            // Mark as completed
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

            return NextResponse.json({
                success: true,
                completed: true,
                videoUrl,
                duration
            });
        }

        // ============ PHASE 1: Start new scene processing ============
        await updateJob(jobId, {
            status: 'processing',
            progress: Math.floor(10 + (currentIndex / totalScenes) * 70),
            progress_message: `Processing scene ${currentIndex + 1}/${totalScenes}...`
        });

        const scene = scenes[currentIndex];
        console.log(`📍 Starting scene ${currentIndex + 1}: ${scene.type.toUpperCase()} - "${scene.text.substring(0, 40)}..."`);

        // Generate TTS for this scene
        const { audioUrl, duration } = await generateSceneTTS(scene.text, voiceId);
        console.log(`🔊 TTS generated for scene ${currentIndex + 1}: ${duration.toFixed(1)}s`);

        if (scene.type === 'face') {
            // Prepare face image as data URL
            let imageDataUrl: string;
            if (faceImageUrl.startsWith('data:')) {
                imageDataUrl = faceImageUrl;
            } else {
                const imgResponse = await axios.get(faceImageUrl, { responseType: 'arraybuffer', timeout: 15000 });
                const imgBase64 = Buffer.from(imgResponse.data).toString('base64');
                const mimeType = imgResponse.headers['content-type'] || 'image/jpeg';
                imageDataUrl = `data:${mimeType};base64,${imgBase64}`;
            }

            // Start WaveSpeed generation
            await updateJob(jobId, {
                progress_message: `Starting face video ${currentIndex + 1}/${totalScenes}...`
            });

            const predictionId = await startFaceVideoGeneration(imageDataUrl, audioUrl);
            console.log(`🚀 WaveSpeed started for scene ${currentIndex + 1}: ${predictionId}`);

            // Save pending scene state
            const newPendingScene: PendingSceneState = {
                predictionId,
                sceneIndex: currentIndex,
                audioUrl,
                duration,
                text: scene.text,
                imageDataUrl
            };

            await updateJob(jobId, {
                pending_scene: newPendingScene,
                progress_message: `Generating face video ${currentIndex + 1}/${totalScenes}...`,
                is_processing: false
            });

            console.log(`💾 Saved pending scene ${currentIndex + 1}, returning for next poll`);

            return NextResponse.json({
                success: true,
                completed: false,
                currentScene: currentIndex,
                totalScenes,
                message: `Scene ${currentIndex + 1} WaveSpeed started, poll again`,
                pendingWaveSpeed: true
            });
        } else {
            // Asset scene - process immediately (no WaveSpeed needed)
            const clipUrl = scene.assetUrl || faceImageUrl;
            const sceneAudioUrl = audioUrl; // Asset scenes need separate audio

            const newProcessedScene: ProcessedScene = {
                index: currentIndex,
                type: scene.type,
                clipUrl,
                audioUrl: sceneAudioUrl,
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

            console.log(`✅ Asset scene ${currentIndex + 1} complete. Next: ${currentIndex + 2}/${totalScenes}`);

            return NextResponse.json({
                success: true,
                completed: false,
                currentScene: currentIndex + 1,
                totalScenes,
                message: `Scene ${currentIndex + 1}/${totalScenes} processed`
            });
        }

    } catch (error) {
        console.error('Error processing scene:', error);

        if (jobId) {
            await updateJob(jobId, {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                progress_message: 'Failed',
                is_processing: false
            });
        }

        return NextResponse.json(
            { error: `Failed to process scene: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
