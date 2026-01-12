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

    // Build scenes from sceneTimings or distribute evenly
    interface MovieScene {
        comment: string;
        duration: number;
        elements: Record<string, unknown>[];
    }
    const scenes: MovieScene[] = [];

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
                        duration: -1,
                        zoom: { direction: i % 2 === 0 ? 'in' : 'out', amount: 1.1 }
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
                        duration: -1,
                        zoom: { direction: i % 2 === 0 ? 'in' : 'out', amount: 1.1 }
                    }
                ]
            });
        }
    }

    // Add captions to first scene
    if (enableCaptions && wordTimings.length > 0 && scenes.length > 0) {
        const captionElement = buildCaptionElement(wordTimings, captionStyle, width, height);
        scenes[0].elements.push(captionElement);
    }

    // Build movie payload
    const movie: Record<string, unknown> = {
        resolution: aspectRatio === '16:9' ? 'full-hd' : 'full-hd-vertical',
        quality: 'high',
        scenes
    };

    // Add audio track
    movie.soundtrack = {
        src: remoteAudioUrl,
        volume: 1
    };

    // Add background music if enabled
    if (enableBackgroundMusic && backgroundMusicUrl) {
        movie.background_music = {
            src: backgroundMusicUrl,
            volume: 0.15
        };
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

    // Style configuration
    const styleConfig: Record<string, unknown> = {
        'bold-classic': {
            font_family: 'Montserrat',
            font_weight: 800,
            font_size: Math.round(height * 0.04),
            fill_color: '#FFFFFF',
            stroke_color: '#000000',
            stroke_width: 3,
            background_color: 'rgba(0,0,0,0.6)',
            background_border_radius: 8
        },
        'minimal': {
            font_family: 'Roboto',
            font_weight: 400,
            font_size: Math.round(height * 0.035),
            fill_color: '#FFFFFF',
            stroke_width: 0
        },
        'neon': {
            font_family: 'Poppins',
            font_weight: 700,
            font_size: Math.round(height * 0.045),
            fill_color: '#00FF88',
            stroke_color: '#000000',
            stroke_width: 2
        }
    };

    const selectedStyle = (styleConfig[style] || styleConfig['bold-classic']) as Record<string, unknown>;

    return {
        type: 'subtitles',
        settings: {
            ...(selectedStyle as object),
            position: 'center',
            y: Math.round(height * 0.75),
            max_width: Math.round(width * 0.9),
            line_height: 1.3
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

export async function POST(request: NextRequest) {
    let jobId: string | null = null;

    try {
        const { jobId: reqJobId } = await request.json();
        jobId = reqJobId;

        if (!jobId) {
            return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
        }

        console.log(`\n🎬 ===== FACELESS VIDEO PROCESS: ${jobId} =====`);

        // Load job from Supabase
        const { data: job, error } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error || !job) {
            console.error('Job not found:', error);
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        // Skip if already completed or failed
        if (job.status === 'completed' || job.status === 'failed') {
            console.log(`Job ${jobId} already ${job.status}`);
            return NextResponse.json({ status: job.status });
        }

        const input = job.input_data as FacelessJobInputData;

        // Check if we have a pending render
        if (input.pendingRender) {
            console.log(`📽️ Checking pending render: ${input.pendingRender.projectId}`);
            const renderResult = await pollJson2Video(input.pendingRender.projectId);

            if (renderResult.completed && renderResult.videoUrl) {
                console.log(`✅ Faceless video complete: ${renderResult.videoUrl}`);
                await updateJob(jobId, {
                    status: 'completed',
                    progress: 100,
                    progress_message: 'Video ready!',
                    result: {
                        videoUrl: renderResult.videoUrl,
                        duration: renderResult.duration || input.duration
                    }
                });
                return NextResponse.json({ status: 'completed', videoUrl: renderResult.videoUrl });
            }

            if (renderResult.failed) {
                await updateJob(jobId, {
                    status: 'failed',
                    progress_message: `Render failed: ${renderResult.status}`,
                    error: renderResult.status
                });
                return NextResponse.json({ status: 'failed', error: renderResult.status });
            }

            // Still rendering...
            await updateJob(jobId, {
                progress: 60,
                progress_message: `Rendering video... (${renderResult.status || 'processing'})`
            });
            return NextResponse.json({ status: 'processing', message: 'Rendering in progress' });
        }

        // Start new render
        await updateJob(jobId, {
            status: 'processing',
            progress: 10,
            progress_message: 'Building video...'
        });

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
