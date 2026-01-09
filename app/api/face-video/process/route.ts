import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { fal } from '@fal-ai/client';
import { supabase } from '@/lib/supabase';
import { convertFaceVideoToJson2VideoFormat, FaceSceneInput } from '@/lib/json2video';

// Configure for reasonable timeout - we only process ONE scene per call
export const maxDuration = 120; // 2 minutes max per scene

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

// Generate WaveSpeed face video - with timeout protection
async function generateFaceVideoClip(imageDataUrl: string, audioUrl: string): Promise<string> {
    // Download audio and convert to base64
    const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
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
            timeout: 30000
        }
    );

    const responseData = response.data.data || response.data;
    const predictionId = responseData.id;

    // Poll for completion - limited to ~90 seconds
    let videoUrl: string | null = null;
    const maxAttempts = 18; // 18 * 5s = 90s

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            const pollUrl = `https://api.wavespeed.ai/api/v3/predictions/${predictionId}/result`;
            const pollResponse = await axios.get(pollUrl, {
                headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
                timeout: 10000
            });

            const pollData = pollResponse.data.data || pollResponse.data;
            if (pollData.status === 'completed' && pollData.output?.video) {
                videoUrl = pollData.output.video;
                break;
            } else if (pollData.status === 'failed') {
                throw new Error('WaveSpeed video generation failed');
            }
        } catch (pollError) {
            if (i === maxAttempts - 1) throw pollError;
        }
    }

    if (!videoUrl) {
        throw new Error('WaveSpeed video generation timed out');
    }

    return videoUrl;
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

        console.log(`🎬 Processing job ${jobId}: scene ${currentIndex + 1}/${totalScenes}`);

        // Check if all scenes are already processed
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
                result_data: { videoUrl, duration, clipAssets }
            });

            console.log(`✅ Job ${jobId} completed!`);

            return NextResponse.json({
                success: true,
                completed: true,
                videoUrl,
                duration
            });
        }

        // Mark as processing
        await updateJob(jobId, {
            status: 'processing',
            progress: Math.floor(10 + (currentIndex / totalScenes) * 70),
            progress_message: `Processing scene ${currentIndex + 1}/${totalScenes}...`
        });

        // Get current scene to process
        const scene = scenes[currentIndex];
        console.log(`📍 Scene ${currentIndex + 1}: ${scene.type.toUpperCase()} - "${scene.text.substring(0, 40)}..."`);

        // Prepare face image as data URL (only once, for face scenes)
        let imageDataUrl: string | null = null;
        if (scene.type === 'face') {
            if (faceImageUrl.startsWith('data:')) {
                imageDataUrl = faceImageUrl;
            } else {
                const imgResponse = await axios.get(faceImageUrl, { responseType: 'arraybuffer' });
                const imgBase64 = Buffer.from(imgResponse.data).toString('base64');
                const mimeType = imgResponse.headers['content-type'] || 'image/jpeg';
                imageDataUrl = `data:${mimeType};base64,${imgBase64}`;
            }
        }

        // Generate TTS for this scene
        const { audioUrl, duration } = await generateSceneTTS(scene.text, voiceId);

        let clipUrl: string;
        let sceneAudioUrl: string | undefined;

        if (scene.type === 'face' && imageDataUrl) {
            await updateJob(jobId, {
                progress_message: `Generating face video ${currentIndex + 1}/${totalScenes}...`
            });

            const wavespeedUrl = await generateFaceVideoClip(imageDataUrl, audioUrl);
            const fileName = `clip_${jobId}_scene_${currentIndex}.mp4`;
            clipUrl = await uploadClipToSupabase(wavespeedUrl, fileName);
            // No separate audio for face scenes (audio baked in)
        } else {
            // Asset scene - use the asset URL directly
            clipUrl = scene.assetUrl || faceImageUrl;
            sceneAudioUrl = audioUrl; // Asset scenes need separate audio
        }

        // Add to processed scenes
        const newProcessedScene: ProcessedScene = {
            index: currentIndex,
            type: scene.type,
            clipUrl,
            audioUrl: sceneAudioUrl,
            duration,
            text: scene.text
        };

        processedScenes.push(newProcessedScene);

        // Update job with new scene and increment index
        await updateJob(jobId, {
            current_scene_index: currentIndex + 1,
            processed_scenes: processedScenes,
            progress: Math.floor(10 + ((currentIndex + 1) / totalScenes) * 70),
            progress_message: currentIndex + 1 >= totalScenes
                ? 'All scenes processed, composing...'
                : `Scene ${currentIndex + 1}/${totalScenes} complete`
        });

        console.log(`✅ Scene ${currentIndex + 1} complete. Next: ${currentIndex + 2}/${totalScenes}`);

        return NextResponse.json({
            success: true,
            completed: false,
            currentScene: currentIndex + 1,
            totalScenes,
            message: `Scene ${currentIndex + 1}/${totalScenes} processed`
        });

    } catch (error) {
        console.error('Error processing scene:', error);

        if (jobId) {
            await updateJob(jobId, {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                progress_message: 'Failed'
            });
        }

        return NextResponse.json(
            { error: `Failed to process scene: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
