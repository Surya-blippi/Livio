import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { fal } from '@fal-ai/client';
import { supabase } from '@/lib/supabase';
import { convertFaceVideoToJson2VideoFormat, FaceSceneInput } from '@/lib/json2video';

// Configure for long-running on Vercel Pro
export const maxDuration = 300; // 5 minutes

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

// Update job progress in Supabase
async function updateJobProgress(jobId: string, progress: number, message: string) {
    await supabase
        .from('video_jobs')
        .update({
            progress,
            progress_message: message,
            updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
}

// Update job status to processing
async function setJobProcessing(jobId: string) {
    await supabase
        .from('video_jobs')
        .update({
            status: 'processing',
            progress: 5,
            progress_message: 'Processing started...',
            updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
}

// Mark job as completed
async function setJobCompleted(jobId: string, resultData: Record<string, unknown>) {
    await supabase
        .from('video_jobs')
        .update({
            status: 'completed',
            progress: 100,
            progress_message: 'Video ready!',
            result_data: resultData,
            updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
}

// Mark job as failed
async function setJobFailed(jobId: string, error: string) {
    await supabase
        .from('video_jobs')
        .update({
            status: 'failed',
            error,
            progress_message: 'Failed',
            updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
}

// Generate TTS for a single scene using fal.ai
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

    const durationMs = result.data.duration_ms || 5000;
    return {
        audioUrl: result.data.audio.url,
        duration: durationMs / 1000
    };
}

// Generate WaveSpeed face video
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
            timeout: 180000
        }
    );

    const responseData = response.data.data || response.data;
    const predictionId = responseData.id;

    // Poll for completion
    let videoUrl: string | null = null;
    const maxAttempts = 60;

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            const pollUrl = `https://api.wavespeed.ai/api/v3/predictions/${predictionId}/result`;
            const pollResponse = await axios.get(pollUrl, {
                headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
                timeout: 15000
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
    const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    const videoBuffer = Buffer.from(response.data);

    const { error } = await supabase.storage
        .from('videos')
        .upload(`clips/${fileName}`, videoBuffer, {
            contentType: 'video/mp4',
            upsert: true
        });

    if (error) {
        console.warn('Supabase upload warning:', error);
        return videoUrl; // Fallback to original URL
    }

    const { data: publicUrl } = supabase.storage
        .from('videos')
        .getPublicUrl(`clips/${fileName}`);

    return publicUrl.publicUrl;
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

        // Skip if already processing or completed
        if (job.status !== 'pending') {
            return NextResponse.json({
                message: `Job already ${job.status}`,
                status: job.status
            });
        }

        // Mark as processing
        await setJobProcessing(jobId);

        const { scenes, faceImageUrl, voiceId, enableBackgroundMusic, enableCaptions } = job.input_data as {
            scenes: SceneInput[];
            faceImageUrl: string;
            voiceId: string;
            enableBackgroundMusic: boolean;
            enableCaptions: boolean;
        };

        console.log('🎬 Processing face video job:', jobId);

        // Prepare face image as data URL
        let imageDataUrl: string;
        if (faceImageUrl.startsWith('data:')) {
            imageDataUrl = faceImageUrl;
        } else {
            const imgResponse = await axios.get(faceImageUrl, { responseType: 'arraybuffer' });
            const imgBase64 = Buffer.from(imgResponse.data).toString('base64');
            const mimeType = imgResponse.headers['content-type'] || 'image/jpeg';
            imageDataUrl = `data:${mimeType};base64,${imgBase64}`;
        }

        await updateJobProgress(jobId, 10, 'Preparing scenes...');

        // Process each scene
        const faceScenes: FaceSceneInput[] = [];
        const clipAssets: { url: string; source: string }[] = [];
        const timestamp = Date.now();
        const totalScenes = scenes.length;

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const sceneProgress = 10 + Math.floor((i / totalScenes) * 60); // 10-70%

            await updateJobProgress(jobId, sceneProgress, `Processing scene ${i + 1}/${totalScenes}...`);

            // Generate TTS
            const { audioUrl, duration } = await generateSceneTTS(scene.text, voiceId);

            let clipUrl: string;
            let sceneAudioUrl: string | undefined;

            if (scene.type === 'face') {
                await updateJobProgress(jobId, sceneProgress + 5, `Generating face video ${i + 1}/${totalScenes}...`);

                const wavespeedUrl = await generateFaceVideoClip(imageDataUrl, audioUrl);
                const fileName = `clip_${timestamp}_scene_${i}.mp4`;
                clipUrl = await uploadClipToSupabase(wavespeedUrl, fileName);
                clipAssets.push({ url: clipUrl, source: 'wavespeed' });
            } else {
                clipUrl = scene.assetUrl || faceImageUrl;
                sceneAudioUrl = audioUrl;
            }

            faceScenes.push({
                url: clipUrl,
                duration,
                text: scene.text,
                sceneType: scene.type,
                audioUrl: sceneAudioUrl
            });
        }

        await updateJobProgress(jobId, 75, 'Composing final video...');

        // Build JSON2Video payload
        const moviePayload = convertFaceVideoToJson2VideoFormat({
            scenes: faceScenes,
            enableCaptions: enableCaptions ?? true,
            captionStyle: 'bold-classic',
            enableBackgroundMusic: enableBackgroundMusic ?? false,
        });

        await updateJobProgress(jobId, 80, 'Rendering with JSON2Video...');

        // Render with JSON2Video
        const { videoUrl, duration } = await renderWithJson2Video(moviePayload);

        // Mark as completed
        await setJobCompleted(jobId, {
            videoUrl,
            duration,
            clipAssets
        });

        console.log('✅ Job completed:', jobId);

        return NextResponse.json({
            success: true,
            jobId,
            videoUrl,
            duration
        });

    } catch (error) {
        console.error('Error processing job:', error);

        if (jobId) {
            await setJobFailed(jobId, error instanceof Error ? error.message : 'Unknown error');
        }

        return NextResponse.json(
            { error: `Failed to process job: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
