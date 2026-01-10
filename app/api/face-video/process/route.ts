import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { fal } from '@fal-ai/client';
import { supabase } from '@/lib/supabase';
import { convertFaceVideoToJson2VideoFormat, FaceSceneInput } from '@/lib/json2video';

// Timeout for serverless function
export const maxDuration = 55;

// Configuration
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_TIME_MS = 45000; // 45 seconds max polling

fal.config({ credentials: process.env.FAL_KEY });

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

interface PendingSceneState {
    predictionId: string;
    sceneIndex: number;
    audioUrl: string;
    duration: number;
    text: string;
    startedAt: number;
}

// NEW: Pending render state for async JSON2Video
interface PendingRenderState {
    projectId: string;
    startedAt: number;
}

interface JobInputData {
    scenes: SceneInput[];
    faceImageUrl: string;
    voiceId: string;
    enableBackgroundMusic: boolean;
    enableCaptions: boolean;
    pendingScene?: PendingSceneState | null;
    pendingRender?: PendingRenderState | null;  // NEW
}

// Generate TTS
async function generateSceneTTS(text: string, voiceId: string): Promise<{ audioUrl: string; duration: number }> {
    console.log(`🎤 TTS: "${text.substring(0, 30)}..."`);
    const result = await fal.subscribe('fal-ai/minimax/speech-02-hd', {
        input: {
            text,
            voice_setting: { voice_id: voiceId, speed: 1, vol: 1, pitch: 0 },
            output_format: 'url'
        },
        logs: false
    }) as unknown as { data: { audio: { url: string }; duration_ms?: number } };

    if (!result.data?.audio?.url) throw new Error('No audio URL from TTS');
    return { audioUrl: result.data.audio.url, duration: (result.data.duration_ms || 5000) / 1000 };
}

// Start WaveSpeed
async function startWaveSpeed(imageDataUrl: string, audioUrl: string): Promise<string> {
    console.log(`🚀 Starting WaveSpeed...`);
    const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const audioBase64 = Buffer.from(audioResponse.data).toString('base64');

    const response = await axios.post(WAVESPEED_API_URL, {
        image: imageDataUrl,
        audio: `data:audio/mpeg;base64,${audioBase64}`,
        resolution: '480p',
        seed: -1
    }, {
        headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30000
    });

    const predictionId = (response.data.data || response.data).id;
    console.log(`📋 WaveSpeed ID: ${predictionId}`);
    return predictionId;
}

// Poll WaveSpeed
async function pollWaveSpeed(predictionId: string): Promise<{ completed: boolean; videoUrl?: string; failed?: boolean }> {
    console.log(`🔍 Polling WaveSpeed: ${predictionId}`);
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_POLL_TIME_MS) {
        try {
            const resp = await axios.get(
                `https://api.wavespeed.ai/api/v3/predictions/${predictionId}/result`,
                { headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` }, timeout: 10000 }
            );
            const data = resp.data.data || resp.data;
            console.log(`📊 Status: ${data.status}`);

            if (data.status === 'completed' && (data.output?.video || data.outputs?.[0])) {
                return { completed: true, videoUrl: data.output?.video || data.outputs[0] };
            }
            if (data.status === 'failed') return { completed: false, failed: true };

            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        } catch (e) {
            console.log(`⚠️ Poll error:`, e instanceof Error ? e.message : e);
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        }
    }
    return { completed: false };
}

// Start JSON2Video render (returns project ID immediately)
async function startJson2VideoRender(
    processedScenes: ProcessedScene[],
    enableCaptions: boolean,
    enableBackgroundMusic: boolean
): Promise<string> {
    console.log(`🎬 Starting JSON2Video render...`);

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

    const response = await axios.post('https://api.json2video.com/v2/movies', moviePayload, {
        headers: { 'x-api-key': JSON2VIDEO_API_KEY, 'Content-Type': 'application/json' }
    });

    const projectId = response.data.project;
    console.log(`📽️ JSON2Video project: ${projectId}`);
    return projectId;
}

// Poll JSON2Video with detailed logging and fetch
async function pollJson2Video(projectId: string): Promise<{ completed: boolean; videoUrl?: string; duration?: number; failed?: boolean; status?: string }> {
    console.log(`\n🔍 === POLLING JSON2VIDEO ===`);
    console.log(`📋 Project ID: ${projectId}`);
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_POLL_TIME_MS) {
        try {
            const url = `https://api.json2video.com/v2/movies?project=${projectId}`;
            console.log(`📡 Requesting: ${url}`);

            const resp = await fetch(url, {
                headers: { 'x-api-key': JSON2VIDEO_API_KEY }
            });

            if (!resp.ok) {
                console.log(`⚠️ HTTP Error: ${resp.status}`);
                throw new Error(`HTTP ${resp.status}`);
            }

            const status = await resp.json();
            console.log(`📊 Response: ${JSON.stringify(status).substring(0, 500)}`);

            if (status.status === 'done' && status.movie) {
                console.log(`✅ RENDER DONE! Video URL: ${status.movie}`);
                return { completed: true, videoUrl: status.movie, duration: status.duration || 30 };
            }
            if (status.status === 'error') {
                console.error(`❌ JSON2Video error:`, status.message || status);
                return { completed: false, failed: true, status: status.message };
            }

            // Return status for debugging
            return { completed: false, status: status.status };

        } catch (e) {
            console.error(`⚠️ Poll error:`, e instanceof Error ? e.message : e);
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        }
    }
    console.log(`⏱️ Polling timeout after ${(Date.now() - startTime) / 1000}s`);
    return { completed: false, status: 'timeout' };
}


// Upload to Supabase
async function uploadToSupabase(videoUrl: string, fileName: string): Promise<string> {
    try {
        const response = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 60000 });
        const { error } = await supabase.storage.from('videos').upload(`clips/${fileName}`, Buffer.from(response.data), {
            contentType: 'video/mp4', upsert: true
        });
        if (error) return videoUrl;
        return supabase.storage.from('videos').getPublicUrl(`clips/${fileName}`).data.publicUrl;
    } catch {
        return videoUrl;
    }
}

// Prepare face image
async function prepareFaceImage(url: string): Promise<string> {
    if (url.startsWith('data:')) return url;
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    return `data:${resp.headers['content-type'] || 'image/jpeg'};base64,${Buffer.from(resp.data).toString('base64')}`;
}

export async function POST(request: NextRequest) {
    let jobId: string | null = null;

    try {
        const { jobId: reqJobId } = await request.json();
        jobId = reqJobId;
        if (!jobId) return NextResponse.json({ error: 'Missing job ID' }, { status: 400 });

        console.log(`\n========== JOB: ${jobId} ==========`);

        // Fetch job
        const { data: job, error: fetchErr } = await supabase.from('video_jobs').select('*').eq('id', jobId).single();
        if (fetchErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        if (job.status === 'completed' || job.status === 'failed') {
            return NextResponse.json({ message: `Already ${job.status}`, status: job.status });
        }

        // Lock check - use timestamp-based stale detection
        const lockAge = Date.now() - new Date(job.updated_at).getTime();
        if (job.is_processing && lockAge < 60000) { // 60 second lock (more aggressive)
            console.log(`🔒 Locked (${Math.round(lockAge / 1000)}s ago), skipping`);
            return NextResponse.json({ skipped: true, lockAge: Math.round(lockAge / 1000) });
        }

        // Acquire lock unconditionally (stale locks will be overwritten)
        console.log(`🔓 Acquiring lock for job ${jobId}...`);
        await supabase.from('video_jobs')
            .update({ is_processing: true, updated_at: new Date().toISOString() })
            .eq('id', jobId);

        // Re-fetch to get latest state
        const { data: freshJob } = await supabase.from('video_jobs').select('*').eq('id', jobId).single();
        if (!freshJob) return NextResponse.json({ error: 'Job gone' }, { status: 404 });


        const inputData = freshJob.input_data as JobInputData;
        const { scenes, faceImageUrl, voiceId, enableBackgroundMusic, enableCaptions, pendingScene, pendingRender } = inputData;
        const totalScenes = scenes.length;
        const currentIndex = freshJob.current_scene_index || 0;
        let processedScenes: ProcessedScene[] = freshJob.processed_scenes || [];

        console.log(`State: ${currentIndex}/${totalScenes}, pending: ${pendingScene?.predictionId || 'none'}, render: ${pendingRender?.projectId || 'none'}`);

        // ======== CASE A: Pending render - poll JSON2Video ========
        if (pendingRender) {
            console.log(`\n📽️ CHECKING PENDING RENDER: ${pendingRender.projectId}`);

            const result = await pollJson2Video(pendingRender.projectId);

            if (result.completed && result.videoUrl) {
                console.log(`✅ RENDER COMPLETE: ${result.videoUrl}`);

                const clipAssets = processedScenes.filter(ps => ps.type === 'face').map(ps => ({ url: ps.clipUrl, source: 'wavespeed' }));

                await supabase.from('video_jobs').update({
                    status: 'completed',
                    progress: 100,
                    progress_message: 'Video ready!',
                    result_data: { videoUrl: result.videoUrl, duration: result.duration, clipAssets },
                    input_data: { ...inputData, pendingRender: null },
                    is_processing: false,
                    updated_at: new Date().toISOString()
                }).eq('id', jobId);

                return NextResponse.json({ success: true, completed: true, videoUrl: result.videoUrl });
            }

            if (result.failed || Date.now() - pendingRender.startedAt > 1200000) { // 20 mins timeout
                console.log(`❌ Render failed or timed out`);
                await supabase.from('video_jobs').update({
                    input_data: { ...inputData, pendingRender: null },
                    progress_message: `Render failed: ${result.status || 'timeout'}`,
                    is_processing: false,
                    updated_at: new Date().toISOString()
                }).eq('id', jobId);
                return NextResponse.json({ retry: true });
            }

            // Still rendering
            const statusMsg = result.status ? `Rendering: ${result.status}` : 'Rendering final video...';
            // Only update DB if message changed (to save writes)
            if (freshJob.progress_message !== statusMsg) {
                await supabase.from('video_jobs').update({
                    progress_message: statusMsg,
                    is_processing: false,
                    updated_at: new Date().toISOString()
                }).eq('id', jobId);
            } else {
                // But always release lock!
                await supabase.from('video_jobs').update({
                    is_processing: false,
                    updated_at: new Date().toISOString()
                }).eq('id', jobId);
            }

            return NextResponse.json({ stillRendering: true, status: result.status });
        }

        // ======== CASE B: Pending scene - poll WaveSpeed ========
        if (pendingScene && pendingScene.sceneIndex === currentIndex) {
            console.log(`\n🔍 CHECKING SCENE ${currentIndex + 1}: ${pendingScene.predictionId}`);

            const result = await pollWaveSpeed(pendingScene.predictionId);

            if (result.completed && result.videoUrl) {
                console.log(`✅ SCENE ${currentIndex + 1} DONE`);
                const clipUrl = await uploadToSupabase(result.videoUrl, `clip_${jobId}_${currentIndex}.mp4`);
                processedScenes.push({
                    index: currentIndex, type: 'face', clipUrl,
                    duration: pendingScene.duration, text: pendingScene.text
                });

                await supabase.from('video_jobs').update({
                    current_scene_index: currentIndex + 1,
                    processed_scenes: processedScenes,
                    input_data: { ...inputData, pendingScene: null },
                    progress: Math.floor(10 + ((currentIndex + 1) / totalScenes) * 70),
                    progress_message: `Scene ${currentIndex + 1}/${totalScenes} done`,
                    is_processing: false,
                    updated_at: new Date().toISOString()
                }).eq('id', jobId);

                return NextResponse.json({ sceneCompleted: currentIndex + 1 });
            }

            if (result.failed || Date.now() - pendingScene.startedAt > 600000) {
                await supabase.from('video_jobs').update({
                    input_data: { ...inputData, pendingScene: null },
                    progress_message: `Scene ${currentIndex + 1} failed, retrying...`,
                    is_processing: false,
                    updated_at: new Date().toISOString()
                }).eq('id', jobId);
                return NextResponse.json({ retry: true });
            }

            await supabase.from('video_jobs').update({
                progress_message: `Generating scene ${currentIndex + 1}/${totalScenes}...`,
                is_processing: false,
                updated_at: new Date().toISOString()
            }).eq('id', jobId);
            return NextResponse.json({ stillProcessing: true });
        }

        // ======== CASE C: All scenes done - start render ========
        if (currentIndex >= totalScenes) {
            console.log(`\n📽️ STARTING FINAL RENDER`);

            await supabase.from('video_jobs').update({
                progress: 80,
                progress_message: 'Starting final render...',
                updated_at: new Date().toISOString()
            }).eq('id', jobId);

            const projectId = await startJson2VideoRender(processedScenes, enableCaptions, enableBackgroundMusic);

            await supabase.from('video_jobs').update({
                input_data: { ...inputData, pendingRender: { projectId, startedAt: Date.now() } },
                progress: 85,
                progress_message: 'Rendering final video...',
                is_processing: false,
                updated_at: new Date().toISOString()
            }).eq('id', jobId);

            return NextResponse.json({ renderStarted: true, projectId });
        }

        // ======== CASE D: Start new scene ========
        console.log(`\n🆕 STARTING SCENE ${currentIndex + 1}/${totalScenes}`);

        await supabase.from('video_jobs').update({
            status: 'processing',
            progress: Math.floor(10 + (currentIndex / totalScenes) * 70),
            progress_message: `Starting scene ${currentIndex + 1}...`,
            updated_at: new Date().toISOString()
        }).eq('id', jobId);

        const scene = scenes[currentIndex];
        const { audioUrl, duration } = await generateSceneTTS(scene.text, voiceId);

        if (scene.type === 'face') {
            const imageDataUrl = await prepareFaceImage(faceImageUrl);
            const predictionId = await startWaveSpeed(imageDataUrl, audioUrl);

            await supabase.from('video_jobs').update({
                input_data: { ...inputData, pendingScene: { predictionId, sceneIndex: currentIndex, audioUrl, duration, text: scene.text, startedAt: Date.now() } },
                progress_message: `Generating scene ${currentIndex + 1}/${totalScenes}...`,
                is_processing: false,
                updated_at: new Date().toISOString()
            }).eq('id', jobId);

            return NextResponse.json({ sceneStarted: currentIndex + 1 });
        } else {
            processedScenes.push({
                index: currentIndex, type: scene.type,
                clipUrl: scene.assetUrl || faceImageUrl,
                audioUrl, duration, text: scene.text
            });

            await supabase.from('video_jobs').update({
                current_scene_index: currentIndex + 1,
                processed_scenes: processedScenes,
                progress: Math.floor(10 + ((currentIndex + 1) / totalScenes) * 70),
                progress_message: `Scene ${currentIndex + 1}/${totalScenes} done`,
                is_processing: false,
                updated_at: new Date().toISOString()
            }).eq('id', jobId);

            return NextResponse.json({ sceneCompleted: currentIndex + 1 });
        }

    } catch (error) {
        console.error(`❌ ERROR:`, error);
        if (jobId) {
            await supabase.from('video_jobs').update({
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown',
                progress_message: 'Failed',
                is_processing: false,
                updated_at: new Date().toISOString()
            }).eq('id', jobId);
        }
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
    }
}
