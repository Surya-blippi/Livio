import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { fal } from '@fal-ai/client';
import { supabase } from '@/lib/supabase';
import { convertFaceVideoToJson2VideoFormat, FaceSceneInput } from '@/lib/json2video';

// Timeout for serverless function
export const maxDuration = 55;

// Configuration
const POLL_INTERVAL_MS = 4000; // 4 seconds between polls
const MAX_POLL_TIME_MS = 50000; // 50 seconds max polling (leave 5s buffer)

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

// Pending scene state
interface PendingSceneState {
    predictionId: string;
    sceneIndex: number;
    audioUrl: string;
    duration: number;
    text: string;
    startedAt: number;
}

interface JobInputData {
    scenes: SceneInput[];
    faceImageUrl: string;
    voiceId: string;
    enableBackgroundMusic: boolean;
    enableCaptions: boolean;
    pendingScene?: PendingSceneState | null;
}

// Generate TTS for a single scene
async function generateSceneTTS(text: string, voiceId: string): Promise<{ audioUrl: string; duration: number }> {
    console.log(`🎤 Generating TTS for: "${text.substring(0, 30)}..."`);

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

    const duration = (result.data.duration_ms || 5000) / 1000;
    console.log(`✅ TTS done: ${duration.toFixed(1)}s`);

    return { audioUrl: result.data.audio.url, duration };
}

// Start WaveSpeed generation
async function startWaveSpeedGeneration(imageDataUrl: string, audioUrl: string): Promise<string> {
    console.log(`🚀 Starting WaveSpeed generation...`);

    // Download audio and convert to base64
    const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const audioBase64 = Buffer.from(audioResponse.data).toString('base64');
    const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

    const response = await axios.post(
        WAVESPEED_API_URL,
        {
            image: imageDataUrl,
            audio: audioDataUrl,
            resolution: '480p',
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
    const predictionId = responseData.id;

    console.log(`📋 WaveSpeed started - Prediction ID: ${predictionId}`);
    console.log(`📋 Full response:`, JSON.stringify(responseData, null, 2));

    return predictionId;
}

// Poll WaveSpeed for result
async function pollWaveSpeedForResult(predictionId: string): Promise<{ completed: boolean; videoUrl?: string; failed?: boolean }> {
    console.log(`🔍 Polling WaveSpeed for prediction: ${predictionId}`);

    const startTime = Date.now();

    while (Date.now() - startTime < MAX_POLL_TIME_MS) {
        try {
            // Try both URL formats
            const pollUrl = `https://api.wavespeed.ai/api/v3/predictions/${predictionId}/result`;
            console.log(`📡 Polling: ${pollUrl}`);

            const pollResponse = await axios.get(pollUrl, {
                headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
                timeout: 10000
            });

            const pollData = pollResponse.data.data || pollResponse.data;
            console.log(`📊 Poll result - Status: ${pollData.status}, Has output: ${!!pollData.output?.video}`);

            if (pollData.status === 'completed') {
                const videoUrl = pollData.output?.video || (pollData.outputs && pollData.outputs[0]);
                if (videoUrl) {
                    console.log(`✅ Video ready: ${videoUrl.substring(0, 50)}...`);
                    return { completed: true, videoUrl };
                }
            } else if (pollData.status === 'failed') {
                console.error(`❌ WaveSpeed failed:`, pollData.error);
                return { completed: false, failed: true };
            }

            console.log(`⏳ Still processing, waiting ${POLL_INTERVAL_MS}ms...`);
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.log(`⚠️ Poll request error: ${error.response?.status} ${error.message}`);
            } else {
                console.log(`⚠️ Poll error:`, error);
            }
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    }

    console.log(`⏰ Polling timeout reached (${MAX_POLL_TIME_MS}ms)`);
    return { completed: false };
}

// Upload video to Supabase
async function uploadToSupabase(videoUrl: string, fileName: string): Promise<string> {
    try {
        console.log(`📤 Uploading to Supabase: ${fileName}`);
        const response = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 60000 });
        const videoBuffer = Buffer.from(response.data);

        const { error } = await supabase.storage
            .from('videos')
            .upload(`clips/${fileName}`, videoBuffer, {
                contentType: 'video/mp4',
                upsert: true
            });

        if (error) {
            console.warn('⚠️ Upload warning:', error);
            return videoUrl;
        }

        const { data: publicUrl } = supabase.storage
            .from('videos')
            .getPublicUrl(`clips/${fileName}`);

        console.log(`✅ Uploaded successfully`);
        return publicUrl.publicUrl;
    } catch (err) {
        console.error('❌ Upload failed:', err);
        return videoUrl;
    }
}

// Prepare face image
async function prepareFaceImage(faceImageUrl: string): Promise<string> {
    if (faceImageUrl.startsWith('data:')) {
        return faceImageUrl;
    }
    const imgResponse = await axios.get(faceImageUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const imgBase64 = Buffer.from(imgResponse.data).toString('base64');
    const mimeType = imgResponse.headers['content-type'] || 'image/jpeg';
    return `data:${mimeType};base64,${imgBase64}`;
}

// Render final video with JSON2Video
async function renderFinalVideo(
    processedScenes: ProcessedScene[],
    enableCaptions: boolean,
    enableBackgroundMusic: boolean
): Promise<{ videoUrl: string; duration: number }> {
    console.log(`🎬 Starting final render with ${processedScenes.length} scenes...`);

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
    console.log(`📽️ JSON2Video project: ${projectId}`);

    for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statusResponse = await axios.get(
            `https://api.json2video.com/v2/movies?project=${projectId}`,
            { headers: { 'x-api-key': JSON2VIDEO_API_KEY } }
        );

        const status = statusResponse.data;
        if (status.status === 'done' && status.movie) {
            console.log(`✅ Final video ready!`);
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

        console.log(`\n========================================`);
        console.log(`🎬 PROCESSING JOB: ${jobId}`);
        console.log(`========================================`);

        // Fetch job
        const { data: job, error: fetchError } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (fetchError || !job) {
            console.error(`❌ Job not found`);
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        // Already done?
        if (job.status === 'completed' || job.status === 'failed') {
            console.log(`⏭️ Job already ${job.status}`);
            return NextResponse.json({ message: `Job already ${job.status}`, status: job.status });
        }

        // CRITICAL: Check if another process is running
        // Use database-level check with timestamp
        if (job.is_processing === true) {
            const lockAge = Date.now() - new Date(job.updated_at).getTime();
            if (lockAge < 120000) { // 2 minute lock
                console.log(`🔒 Job locked (${Math.round(lockAge / 1000)}s ago), skipping`);
                return NextResponse.json({ message: 'Processing in progress', skipped: true });
            }
            console.log(`🔓 Stale lock detected (${Math.round(lockAge / 1000)}s), taking over`);
        }

        // Acquire lock FIRST, before reading data
        const { error: lockError } = await supabase
            .from('video_jobs')
            .update({ is_processing: true, updated_at: new Date().toISOString() })
            .eq('id', jobId)
            .eq('is_processing', false); // Only acquire if not already locked

        if (lockError) {
            console.log(`⚠️ Could not acquire lock, another process may have it`);
            return NextResponse.json({ message: 'Could not acquire lock', skipped: true });
        }

        // Re-fetch job to get latest state
        const { data: freshJob } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (!freshJob) {
            return NextResponse.json({ error: 'Job disappeared' }, { status: 404 });
        }

        const inputData = freshJob.input_data as JobInputData;
        const { scenes, faceImageUrl, voiceId, enableBackgroundMusic, enableCaptions, pendingScene } = inputData;
        const totalScenes = scenes.length;
        const currentIndex = freshJob.current_scene_index || 0;
        let processedScenes: ProcessedScene[] = freshJob.processed_scenes || [];

        console.log(`📊 State: Scene ${currentIndex + 1}/${totalScenes}, Pending: ${pendingScene?.predictionId || 'none'}`);
        console.log(`📊 Processed scenes: ${processedScenes.length}`);

        // ============ CASE 1: Pending scene - poll for result ============
        if (pendingScene && pendingScene.sceneIndex === currentIndex) {
            console.log(`\n🔍 CHECKING PENDING SCENE ${currentIndex + 1}`);
            console.log(`   Prediction ID: ${pendingScene.predictionId}`);
            console.log(`   Started: ${Math.round((Date.now() - pendingScene.startedAt) / 1000)}s ago`);

            await supabase.from('video_jobs').update({
                progress_message: `Checking scene ${currentIndex + 1}/${totalScenes}...`,
                updated_at: new Date().toISOString()
            }).eq('id', jobId);

            const pollResult = await pollWaveSpeedForResult(pendingScene.predictionId);

            if (pollResult.completed && pollResult.videoUrl) {
                console.log(`\n✅ SCENE ${currentIndex + 1} COMPLETED!`);

                const fileName = `clip_${jobId}_scene_${currentIndex}.mp4`;
                const clipUrl = await uploadToSupabase(pollResult.videoUrl, fileName);

                const newScene: ProcessedScene = {
                    index: currentIndex,
                    type: 'face',
                    clipUrl,
                    duration: pendingScene.duration,
                    text: pendingScene.text
                };
                processedScenes.push(newScene);

                const nextIndex = currentIndex + 1;
                const updatedInputData = { ...inputData, pendingScene: null };

                await supabase.from('video_jobs').update({
                    current_scene_index: nextIndex,
                    processed_scenes: processedScenes,
                    input_data: updatedInputData,
                    progress: Math.floor(10 + (nextIndex / totalScenes) * 70),
                    progress_message: nextIndex >= totalScenes
                        ? 'All scenes done, composing...'
                        : `Scene ${currentIndex + 1}/${totalScenes} complete`,
                    is_processing: false,
                    updated_at: new Date().toISOString()
                }).eq('id', jobId);

                console.log(`✅ Saved scene ${currentIndex + 1}. Next: ${nextIndex + 1}/${totalScenes}`);
                return NextResponse.json({ success: true, sceneCompleted: currentIndex + 1, totalScenes });
            }

            if (pollResult.failed) {
                console.log(`\n❌ SCENE ${currentIndex + 1} FAILED - will retry`);
                const updatedInputData = { ...inputData, pendingScene: null };
                await supabase.from('video_jobs').update({
                    input_data: updatedInputData,
                    progress_message: `Scene ${currentIndex + 1} failed, retrying...`,
                    is_processing: false,
                    updated_at: new Date().toISOString()
                }).eq('id', jobId);
                return NextResponse.json({ success: true, retry: true });
            }

            // Scene timeout check
            const sceneAge = Date.now() - pendingScene.startedAt;
            if (sceneAge > 600000) { // 10 minutes
                console.log(`\n⏰ SCENE ${currentIndex + 1} TIMED OUT`);
                const updatedInputData = { ...inputData, pendingScene: null };
                await supabase.from('video_jobs').update({
                    input_data: updatedInputData,
                    progress_message: `Scene ${currentIndex + 1} timed out, retrying...`,
                    is_processing: false,
                    updated_at: new Date().toISOString()
                }).eq('id', jobId);
                return NextResponse.json({ success: true, retry: true });
            }

            // Still processing
            console.log(`\n⏳ Scene ${currentIndex + 1} still generating...`);
            await supabase.from('video_jobs').update({
                progress_message: `Generating face video ${currentIndex + 1}/${totalScenes}...`,
                is_processing: false,
                updated_at: new Date().toISOString()
            }).eq('id', jobId);
            return NextResponse.json({ success: true, stillProcessing: true });
        }

        // ============ CASE 2: All scenes done - render final ============
        if (currentIndex >= totalScenes) {
            console.log(`\n📽️ ALL SCENES DONE - RENDERING FINAL VIDEO`);

            await supabase.from('video_jobs').update({
                progress: 80,
                progress_message: 'Composing final video...',
                updated_at: new Date().toISOString()
            }).eq('id', jobId);

            const { videoUrl, duration } = await renderFinalVideo(
                processedScenes,
                enableCaptions,
                enableBackgroundMusic
            );

            const clipAssets = processedScenes
                .filter(ps => ps.type === 'face')
                .map(ps => ({ url: ps.clipUrl, source: 'wavespeed' }));

            await supabase.from('video_jobs').update({
                status: 'completed',
                progress: 100,
                progress_message: 'Video ready!',
                result_data: { videoUrl, duration, clipAssets },
                is_processing: false,
                updated_at: new Date().toISOString()
            }).eq('id', jobId);

            console.log(`\n✅ JOB COMPLETED: ${videoUrl}`);
            return NextResponse.json({ success: true, completed: true, videoUrl, duration });
        }

        // ============ CASE 3: Start new scene ============
        console.log(`\n🆕 STARTING SCENE ${currentIndex + 1}/${totalScenes}`);

        await supabase.from('video_jobs').update({
            status: 'processing',
            progress: Math.floor(10 + (currentIndex / totalScenes) * 70),
            progress_message: `Starting scene ${currentIndex + 1}/${totalScenes}...`,
            updated_at: new Date().toISOString()
        }).eq('id', jobId);

        const scene = scenes[currentIndex];
        console.log(`   Type: ${scene.type}`);
        console.log(`   Text: "${scene.text.substring(0, 50)}..."`);

        const { audioUrl, duration } = await generateSceneTTS(scene.text, voiceId);

        if (scene.type === 'face') {
            const imageDataUrl = await prepareFaceImage(faceImageUrl);
            const predictionId = await startWaveSpeedGeneration(imageDataUrl, audioUrl);

            const newPendingScene: PendingSceneState = {
                predictionId,
                sceneIndex: currentIndex,
                audioUrl,
                duration,
                text: scene.text,
                startedAt: Date.now()
            };

            const updatedInputData = { ...inputData, pendingScene: newPendingScene };

            // CRITICAL: Save pending scene and release lock atomically
            const { error: updateError } = await supabase.from('video_jobs').update({
                input_data: updatedInputData,
                progress_message: `Generating face video ${currentIndex + 1}/${totalScenes}...`,
                is_processing: false,
                updated_at: new Date().toISOString()
            }).eq('id', jobId);

            if (updateError) {
                console.error(`❌ Failed to save pending scene:`, updateError);
                throw new Error('Failed to save pending scene');
            }

            console.log(`\n💾 Saved pending scene with prediction: ${predictionId}`);
            return NextResponse.json({ success: true, sceneStarted: currentIndex + 1, predictionId });
        } else {
            // Asset scene - immediate
            const newScene: ProcessedScene = {
                index: currentIndex,
                type: scene.type,
                clipUrl: scene.assetUrl || faceImageUrl,
                audioUrl: audioUrl,
                duration,
                text: scene.text
            };
            processedScenes.push(newScene);

            await supabase.from('video_jobs').update({
                current_scene_index: currentIndex + 1,
                processed_scenes: processedScenes,
                progress: Math.floor(10 + ((currentIndex + 1) / totalScenes) * 70),
                progress_message: `Scene ${currentIndex + 1}/${totalScenes} complete`,
                is_processing: false,
                updated_at: new Date().toISOString()
            }).eq('id', jobId);

            console.log(`\n✅ Asset scene ${currentIndex + 1} done`);
            return NextResponse.json({ success: true, sceneCompleted: currentIndex + 1, totalScenes });
        }

    } catch (error) {
        console.error(`\n❌ ERROR:`, error);

        if (jobId) {
            await supabase.from('video_jobs').update({
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                progress_message: 'Failed',
                is_processing: false,
                updated_at: new Date().toISOString()
            }).eq('id', jobId);
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
