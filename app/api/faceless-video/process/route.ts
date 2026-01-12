import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/lib/supabase';

// Timeout for serverless function
export const maxDuration = 55;

const JSON2VIDEO_API_KEY = process.env.JSON2VIDEO_API_KEY!;

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

interface FacelessJobInputData {
    remoteAudioUrl: string;
    wordTimings: WordTiming[];
    duration: number;
    sceneTimings?: SceneTiming[];
    images: string[];
    aspectRatio: '9:16' | '16:9' | '1:1';
    captionStyle: string;
    enableBackgroundMusic: boolean;
    enableCaptions: boolean;
    backgroundMusicUrl?: string;
    // Processing state
    pendingRender?: { projectId: string; startedAt: number } | null;
}

// Update job in Supabase
async function updateJob(jobId: string, updates: Record<string, unknown>) {
    const { error } = await supabase
        .from('video_jobs')
        .update(updates)
        .eq('id', jobId);
    if (error) console.error(`Failed to update job ${jobId}:`, error);
}

// Build JSON2Video movie payload for faceless video
function buildJson2VideoPayload(input: FacelessJobInputData) {
    const { images, remoteAudioUrl, wordTimings, duration, sceneTimings, aspectRatio, captionStyle, enableBackgroundMusic, enableCaptions, backgroundMusicUrl } = input;

    // Calculate aspect ratio dimensions
    const dimensions: Record<string, { width: number; height: number }> = {
        '9:16': { width: 1080, height: 1920 },
        '16:9': { width: 1920, height: 1080 },
        '1:1': { width: 1080, height: 1080 }
    };
    const { width, height } = dimensions[aspectRatio] || { width: 1080, height: 1920 };

    interface MovieScene {
        comment: string;
        duration: number;
        elements: Record<string, unknown>[];
    }
    const scenes: MovieScene[] = [];

    // Helper to create Ken Burns effect
    const getKenBurnsEffect = (index: number) => {
        const effects = [
            { zoom: { start: 1.0, end: 1.15 } },
            { zoom: { start: 1.15, end: 1.0 } },
            { zoom: { start: 1.0, end: 1.2 }, pan: { start: 'center', end: 'top-left' } },
            { zoom: { start: 1.2, end: 1.0 }, pan: { start: 'top-right', end: 'center' } },
        ];
        return effects[index % effects.length];
    };

    if (sceneTimings && sceneTimings.length > 0 && images.length >= sceneTimings.length) {
        // Scene-based: each scene has its own image and timing
        for (let i = 0; i < sceneTimings.length; i++) {
            const st = sceneTimings[i];
            const sceneDuration = st.endTime - st.startTime;
            scenes.push({
                comment: st.text.substring(0, 50),
                duration: sceneDuration,
                elements: [
                    {
                        type: 'image',
                        src: images[i] || images[0],
                        resize: 'cover',
                        ...getKenBurnsEffect(i)
                    }
                ]
            });
        }
    } else {
        // Fallback: distribute duration evenly across images
        const durationPerImage = duration / images.length;
        for (let i = 0; i < images.length; i++) {
            scenes.push({
                comment: `Scene ${i + 1}`,
                duration: durationPerImage,
                elements: [
                    {
                        type: 'image',
                        src: images[i],
                        resize: 'cover',
                        ...getKenBurnsEffect(i)
                    }
                ]
            });
        }
    }

    // Add captions to first scene (spanning entire video) if enabled
    // Note: JSON2Video recommends splitting subtitles per scene for reliability, 
    // but for continuous audio, adding to first scene with long duration works if handled correctly.
    // However, safest bet is to use 'voice' element or just one long scene if audio is one track.
    // Since we have multiple scenes for visual variety, we add a movie-level element for subtitles logic
    // But JSON2Video structure puts elements inside scenes or at movie level.

    // We will attach subtitles to the first scene but with duration covering the whole video
    // This is a common pattern for "overlay" elements.
    if (enableCaptions && wordTimings.length > 0 && scenes.length > 0) {
        const captionElement = buildCaptionElement(wordTimings, captionStyle, width, height);
        // Ensure caption element has no specific duration so it lasts as long as its content defined by start/end times
        scenes[0].elements.push(captionElement);
    }

    // Build movie payload
    const movie: Record<string, unknown> = {
        resolution: aspectRatio === '16:9' ? 'full-hd' : 'full-hd-vertical',
        quality: 'high',
        scenes,
        elements: [] // Movie level elements
    };

    // Add audio track as movie-level element
    if (movie.elements && Array.isArray(movie.elements)) {
        movie.elements.push({
            type: 'audio',
            src: remoteAudioUrl,
            volume: 1.0
        });

        // Add background music if enabled
        if (enableBackgroundMusic && backgroundMusicUrl) {
            movie.elements.push({
                type: 'audio',
                src: backgroundMusicUrl,
                volume: 0.15,
                loop: true
            });
        }
    }

    return movie;
}

// Build caption element for JSON2Video
function buildCaptionElement(wordTimings: WordTiming[], style: string, width: number, height: number) {
    // Create text with word-by-word timing
    const textBlocks = wordTimings.map(wt => ({
        value: wt.word,
        start: wt.startTime,
        end: wt.endTime
    }));

    // Style configuration matching lib/json2video.ts
    const styleConfig: Record<string, unknown> = {
        'bold-classic': {
            'font-family': 'Montserrat',
            'font-weight': '800',
            'font-size': Math.round(height * 0.05),
            'font-color': '#FFFFFF',
            'stroke-color': '#000000',
            'stroke-width': 3,
            'background-color': 'rgba(0,0,0,0.6)',
            'background-border-radius': 8,
            'position': 'bottom-center',
            'y': Math.round(height * 0.15) // Offset from bottom
        },
        'minimal': {
            'font-family': 'Roboto',
            'font-weight': '400',
            'font-size': Math.round(height * 0.04),
            'font-color': '#FFFFFF',
            'stroke-width': 0,
            'position': 'bottom-center',
            'y': Math.round(height * 0.1)
        },
        'neon': {
            'font-family': 'Poppins',
            'font-weight': '700',
            'font-size': Math.round(height * 0.05),
            'font-color': '#00FF88',
            'stroke-color': '#000000',
            'stroke-width': 2,
            'position': 'bottom-center',
            'y': Math.round(height * 0.15)
        }
    };

    // Use cast to avoid type errors since we know the structure
    const selectedStyle = (styleConfig[style] || styleConfig['bold-classic']) as Record<string, unknown>;

    return {
        type: 'subtitles',
        settings: {
            ...selectedStyle,
            // Common settings
            'max-width': Math.round(width * 0.9),
            'line-height': 1.3,
            'vertical-alignment': 'center',
            'horizontal-alignment': 'center'
        },
        text: textBlocks
    };
}

// Start JSON2Video render
async function startJson2VideoRender(payload: Record<string, unknown>): Promise<string> {
    console.log('🎬 Starting JSON2Video render for faceless video...');

    // Add webhook if available
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
        if (!payload.exports) payload.exports = [];
        if ((payload.exports as unknown[]).length === 0) (payload.exports as unknown[]).push({ destinations: [] });
        const exports = payload.exports as { destinations?: { type: string; endpoint: string }[] }[];
        exports[0].destinations = exports[0].destinations || [];
        exports[0].destinations.push({
            type: 'webhook',
            endpoint: `${appUrl}/api/webhooks/json2video`
        });
    }

    const response = await axios.post('https://api.json2video.com/v2/movies', payload, {
        headers: { 'x-api-key': JSON2VIDEO_API_KEY, 'Content-Type': 'application/json' }
    });

    const projectId = response.data.project;
    console.log(`📽️ JSON2Video project: ${projectId}`);
    return projectId;
}

// Poll JSON2Video
async function pollJson2Video(projectId: string): Promise<{ completed: boolean; videoUrl?: string; duration?: number; failed?: boolean; status?: string }> {
    console.log(`🔍 Checking JSON2Video: ${projectId}`);

    try {
        const url = `https://api.json2video.com/v2/movies?project=${projectId}&_t=${Date.now()}`;
        const resp = await fetch(url, {
            headers: { 'x-api-key': JSON2VIDEO_API_KEY },
            cache: 'no-store'
        });

        if (!resp.ok) {
            return { completed: false, status: `HTTP ${resp.status}` };
        }

        const status = await resp.json();

        if (status.movie && status.movie.status === 'done') {
            return { completed: true, videoUrl: status.movie.url, duration: status.movie.duration || 30 };
        }

        if (status.movie && status.movie.status === 'error') {
            return { completed: false, failed: true, status: status.movie.message };
        }

        if (status.status === 'done' && status.movie) {
            return { completed: true, videoUrl: status.movie, duration: status.duration || 30 };
        }

        if (status.status === 'error') {
            return { completed: false, failed: true, status: status.message };
        }

        return { completed: false, status: status.status || 'processing' };

    } catch (e) {
        console.error('Poll error:', e instanceof Error ? e.message : e);
        return { completed: false, status: 'connection error' };
    }
}

// Upload base64 image to Supabase and return public URL
async function uploadBase64Image(base64Data: string, jobId: string, index: number): Promise<string> {
    if (!base64Data.startsWith('data:image')) return base64Data;

    try {
        const match = base64Data.match(/^data:(image\/[a-z]+);base64,(.+)$/);
        if (!match) return base64Data;

        const contentType = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const ext = contentType.split('/')[1];
        const fileName = `faceless/${jobId}/image_${index}.${ext}`;

        // Upload to 'videos' bucket (or 'images' if available, defaulting to videos as it works for clips)
        // Using 'videos' bucket based on face-video implementation
        const { error } = await supabase.storage
            .from('videos')
            .upload(fileName, buffer, {
                contentType,
                upsert: true
            });

        if (error) {
            console.error('Upload error:', error);
            // Attempt to continue or fail? Let's return original and hope for best or empty?
            // If upload fails, JSON2Video will definitely fail with base64. 
            // Better to throw or return null? Returning original string causes 400. 
            // For now, log and return original.
            return base64Data;
        }

        const { data } = supabase.storage
            .from('videos')
            .getPublicUrl(fileName);

        return data.publicUrl;
    } catch (e) {
        console.error('Image processing error:', e);
        return base64Data;
    }
}

export async function POST(request: NextRequest) {
    let jobId: string | null = null;

    try {
        // Parse request body safely
        let body;
        try {
            body = await request.json();
        } catch (e) {
            console.error("Failed to parse JSON body:", e);
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        const { jobId: reqJobId } = body;
        jobId = reqJobId;

        if (!jobId) {
            return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
        }

        console.log(`\n========== FACELESS JOB: ${jobId} ==========`);

        // Load job state
        const { data: job, error: fetchError } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (fetchError || !job) {
            console.error(`Job ${jobId} not found or error:`, fetchError);
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        if (job.status === 'completed' || job.status === 'failed') {
            return NextResponse.json({ message: `Job already ${job.status}`, status: job.status });
        }

        // Lock check (similar to face video)
        const lockAge = Date.now() - new Date(job.updated_at).getTime();
        if (job.is_processing && lockAge < 60000) {
            console.log(`🔒 Locked (${Math.round(lockAge / 1000)}s ago), skipping`);
            return NextResponse.json({ skipped: true });
        }

        // Acquire lock
        await updateJob(jobId, { is_processing: true, updated_at: new Date().toISOString() });

        // Reload job to ensure we have latest data
        const { data: freshJob } = await supabase.from('video_jobs').select('*').eq('id', jobId).single();
        if (!freshJob) return NextResponse.json({ error: 'Job lost' }, { status: 404 });

        const input = freshJob.input_data as FacelessJobInputData;

        // Validation - Critical for faceless video
        if (!input.images || input.images.length === 0) {
            const errorMsg = 'No images provided for faceless video';
            console.error(errorMsg);
            await updateJob(jobId, { status: 'failed', error: errorMsg, is_processing: false });
            return NextResponse.json({ error: errorMsg }, { status: 400 });
        }

        // Upload images if they are base64
        // Process images sequentially to avoid overwhelming memory/network if many
        const processedImages: string[] = [];
        let imagesUpdated = false;

        for (let i = 0; i < input.images.length; i++) {
            const img = input.images[i];
            if (img.startsWith('data:image')) {
                console.log(`📤 Uploading image ${i + 1}/${input.images.length}...`);
                const url = await uploadBase64Image(img, jobId, i);
                processedImages.push(url);
                imagesUpdated = true;
            } else {
                processedImages.push(img);
            }
        }

        // Update input data with public URLs if we uploaded anything
        if (imagesUpdated) {
            input.images = processedImages;
            await updateJob(jobId, { input_data: input });
            console.log('✅ Images uploaded and job updated');
        }

        // Check for pending render
        if (input.pendingRender) {
            const { projectId } = input.pendingRender;
            console.log(`Checking pending render: ${projectId}`);

            const status = await pollJson2Video(projectId);

            if (status.completed) {
                console.log('✅ Video completed:', status.videoUrl);
                await updateJob(jobId, {
                    status: 'completed',
                    progress: 100,
                    is_processing: false,
                    result_data: {
                        videoUrl: status.videoUrl,
                        duration: status.duration
                    }
                });
                return NextResponse.json({ completed: true, videoUrl: status.videoUrl });
            } else if (status.failed) {
                console.error('❌ Render failed');
                await updateJob(jobId, {
                    status: 'failed',
                    error: status.status || 'Render failed',
                    is_processing: false
                });
                return NextResponse.json({ failed: true, error: status.status });
            } else {
                console.log('⏳ Still processing...');
                // Touch updated_at to keep lock active-ish or just release?
                // Actually release lock so next poll can pick it up
                await updateJob(jobId, { is_processing: false });
                return NextResponse.json({ completed: false, status: status.status });
            }
        }

        // Start new render
        console.log('🎬 Starting new render...');
        await updateJob(jobId, { progress: 10, progress_message: 'Preparing assets...' });

        // Build payload and start render
        const moviePayload = buildJson2VideoPayload(input);

        await updateJob(jobId, {
            progress: 30,
            progress_message: 'Starting render...'
        });

        const projectId = await startJson2VideoRender(moviePayload);

        // Save pending render state
        await updateJob(jobId, {
            progress: 50,
            progress_message: 'Rendering video...',
            input_data: { ...input, pendingRender: { projectId, startedAt: Date.now() } }
        });

        // Wait a bit and check once
        await new Promise(r => setTimeout(r, 5000));
        const initialCheck = await pollJson2Video(projectId);

        if (initialCheck.completed && initialCheck.videoUrl) {
            await updateJob(jobId, {
                status: 'completed',
                progress: 100,
                progress_message: 'Video ready!',
                result: {
                    videoUrl: initialCheck.videoUrl,
                    duration: initialCheck.duration || input.duration
                }
            });
            return NextResponse.json({ status: 'completed', videoUrl: initialCheck.videoUrl });
        }

        return NextResponse.json({ status: 'processing', projectId });

    } catch (error) {
        console.error('Faceless video process error:', error);
        if (jobId) {
            await updateJob(jobId, {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                progress_message: 'Processing failed'
            });
        }
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Process failed' },
            { status: 500 }
        );
    }
}
