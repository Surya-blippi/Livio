import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateImage, generateSceneTTS } from '@/lib/fal';
import {
    startJson2VideoRender,
    pollJson2Video,
    Json2VideoMovie,
    Json2VideoScene
} from '@/lib/json2video';

// Timeout for serverless function
export const maxDuration = 55;

interface FacelessSceneInput {
    text: string;
    assetUrl: string;
}

interface ProcessedScene {
    index: number;
    text: string;
    assetUrl: string;
    audioUrl: string;
    duration: number;
}

interface FacelessJobInputData {
    scenes: FacelessSceneInput[];
    voiceId: string;
    aspectRatio: '9:16' | '16:9' | '1:1';
    captionStyle: string;
    enableBackgroundMusic: boolean;
    enableCaptions: boolean;
    backgroundMusicUrl?: string;
    // State managed during processing
    processedScenes?: ProcessedScene[];
    currentSceneIndex?: number;
    pendingRender?: { projectId: string; startedAt: number } | null;
    allAssets?: string[];
}

// Update job in Supabase
async function updateJob(jobId: string, updates: Record<string, unknown>) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
        .from('video_jobs')
        .update(updates)
        .eq('id', jobId);
    if (error) console.error(`Failed to update job ${jobId}: `, error);
}

// Upload base64 image to Supabase and return public URL
async function uploadBase64Image(base64Data: string, jobId: string, index: number): Promise<string> {
    if (!base64Data.startsWith('data:image')) return base64Data;
    const supabase = getSupabaseAdmin();

    try {
        // Updated regex to handle more image types including jpeg
        const match = base64Data.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,(.+)$/);
        if (!match) {
            console.error('Invalid base64 format');
            throw new Error('Invalid base64 image format');
        }

        const contentType = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        // Handle both 'jpeg' and 'jpg' extensions
        let ext = contentType.split('/')[1];
        if (ext === 'jpeg') ext = 'jpg';

        const fileName = `faceless/${jobId}/image_${index}.${ext}`;
        console.log(`Uploading image to: ${fileName}`);

        const { error } = await supabase.storage
            .from('videos')
            .upload(fileName, buffer, {
                contentType,
                upsert: true
            });

        if (error) {
            console.error('Supabase upload error:', error);
            throw new Error(`Failed to upload image: ${error.message}`);
        }

        const { data } = supabase.storage
            .from('videos')
            .getPublicUrl(fileName);

        console.log(`Image uploaded successfully: ${data.publicUrl}`);
        return data.publicUrl;
    } catch (e) {
        console.error('Image processing error:', e);
        throw e; // Re-throw to fail the job properly
    }
}
// Caption style configurations for JSON2Video subtitles
function getCaptionSettings(styleName: string): Record<string, unknown> {
    const styles: Record<string, Record<string, unknown>> = {
        'bold-classic': {
            'style': 'classic',
            'font-family': 'Bangers',
            'font-size': 120,
            'word-color': '#FFD700',
            'line-color': '#FFFFFF',
            'outline-color': '#000000',
            'outline-width': 2,
            'shadow-color': '#000000',
            'shadow-offset': 5,
            'position': 'bottom-center',
            'max-words-per-line': 3,
        },
        'clean-cut': {
            'style': 'classic-progressive',
            'font-family': 'NotoSans Bold',
            'font-size': 80,
            'word-color': '#000000',
            'line-color': '#555555',
            'outline-color': '#FFFFFF',
            'outline-width': 4,
            'max-words-per-line': 3
        },
        'modern-pop': {
            'style': 'classic-progressive',
            'font-size': 75,
            'font-family': 'Roboto',
            'font-weight': '900',
            'word-color': '#FFFF00',
            'line-color': '#FFFFFF',
            'outline-color': '#000000',
            'outline-width': 4,
            'position': 'bottom-center',
            'max-words-per-line': 4,
        },
        'minimal': {
            'style': 'classic',
            'font-size': 60,
            'font-family': 'Arial',
            'word-color': '#FFFFFF',
            'line-color': '#FFFFFF',
            'outline-color': '#000000',
            'outline-width': 2,
            'position': 'bottom-center',
            'max-words-per-line': 5,
        },
        'vibrant': {
            'style': 'boxed-line',
            'font-size': 85,
            'font-family': 'Oswald Bold',
            'word-color': '#FFD700',
            'box-color': '#FF4500DD',
            'position': 'bottom-center',
            'max-words-per-line': 3,
            'all-caps': true,
        },
    };
    return styles[styleName] || styles['bold-classic'];
}

// Build JSON2Video movie payload with captions and background music support
function buildJson2VideoPayload(
    scenes: ProcessedScene[],
    aspectRatio: '9:16' | '16:9' | '1:1',
    enableBgMusic: boolean,
    bgMusicUrl?: string,
    enableCaptions?: boolean,
    captionStyle?: string,
    allAssets?: string[]
): Json2VideoMovie {
    const dimensions: Record<string, { width: number; height: number }> = {
        '9:16': { width: 1080, height: 1920 },
        '16:9': { width: 1920, height: 1080 },
        '1:1': { width: 1080, height: 1080 }
    };
    const { width, height } = dimensions[aspectRatio] || { width: 1080, height: 1920 };

    // define visual cut generator
    const getVisualCutElements = (assetUrl: string, duration: number, panIndex: number, startTime: number): any[] => {
        const pans = ['left-right', 'right-left', 'top-bottom', 'bottom-top'];
        const pan = pans[panIndex % pans.length];

        const elements: any[] = [
            {
                type: 'image',
                src: assetUrl,
                resize: 'contain',
                position: 'center-center',
                zoom: 2,
                pan: pan,
                start: startTime,
                duration: duration,
                'fade-in': 0.5,
                'fade-out': 0.3
            }
        ];

        // Add click sound at the start of the cut
        elements.push({
            type: 'audio',
            src: 'https://tfaumdiiljwnjmfnonrc.supabase.co/storage/v1/object/public/Bgmusic/clickit.mp3',
            start: startTime,
            volume: 0.4
        });

        return elements;
    };

    // Build scenes with visual cuts for better pacing
    const movieScenes: any[] = scenes.map((scene, i) => {
        const VISUAL_Duration_TARGET = 4; // Target ~4 seconds per visual cut
        const numCuts = Math.max(1, Math.ceil(scene.duration / VISUAL_Duration_TARGET));
        const cutDuration = scene.duration / numCuts;

        let visualElements: any[] = [];

        let globalAssetIndex = 0;

        for (let k = 0; k < numCuts; k++) {
            // Global Rotation: Use next asset from pool if available, else scene asset (but scene creation already rotated, so just use global pool)
            // If allAssets provided, prioritize it for diversity
            const assetToUse = (allAssets && allAssets.length > 0)
                ? allAssets[(i * 10 + k) % allAssets.length] // (i*10+k) ensures unique index across scenes (assuming <10 cuts/scene)
                : scene.assetUrl;

            // wait, simpler global index?
            // i is scene index. k is cut index.
            // Let's use a deterministic hash or just (sceneIndex + cutIndex) logic?
            // If I maintain a counter outside? I can't easily inside map.
            // (i + k) isn't great because Scene 0 Cut 1 = 1, Scene 1 Cut 0 = 1. Repetition.
            // Better: use accumulative index? Scene i starts at... we don't know start index easily without reduce.
            // Let's use ALL provided assets in a predictable cycle.
            // Asset Index = (Total processed cuts so far)? NO.
            // Heuristic: (SceneIndex * 5 + CutIndex) % TotalAssets.

            const assetIndex = (i * 3 + k); // Shift by 3 for each scene (most scenes have ~2-3 cuts?)
            const effectiveAssetUrl = (allAssets && allAssets.length > 0)
                ? allAssets[assetIndex % allAssets.length]
                : scene.assetUrl;

            const cuts = getVisualCutElements(
                effectiveAssetUrl,
                cutDuration,
                i + k, // Change pan direction for each cut
                k * cutDuration // Start time relative to scene
            );
            visualElements.push(...cuts);
        }

        return {
            comment: `Scene ${i + 1}`,
            duration: scene.duration,
            'background-color': '#000000',
            elements: [
                ...visualElements,
                // Continuous TTS narration for the scene
                {
                    type: 'audio',
                    src: scene.audioUrl,
                    volume: 1.0,
                    start: 0
                }
            ]
        };
    });

    // Movie-level elements (audio, subtitles)
    const elements: any[] = [];

    // Add background music if enabled (using exact reference format)
    if (enableBgMusic) {
        const musicUrl = bgMusicUrl || 'https://tfaumdiiljwnjmfnonrc.supabase.co/storage/v1/object/public/Bgmusic/Feeling%20Blue.mp3';
        console.log('🎵 Adding background music:', musicUrl);
        elements.push({
            type: 'audio',
            src: musicUrl,
            start: 0,
            duration: -2,
            volume: 0.12,
            'fade-in': 1,
            'fade-out': 2,
            'loop': -1
        });
    }

    // Add captions/subtitles if enabled (using exact reference format)
    if (enableCaptions) {
        console.log('📝 Adding captions with style:', captionStyle || 'bold-classic');
        const captionSettings = getCaptionSettings(captionStyle || 'bold-classic');
        elements.push({
            type: 'subtitles',
            language: 'auto',
            settings: captionSettings
        });
    }

    return {
        resolution: 'custom',
        width,
        height,
        fps: 30,
        quality: 'high',
        scenes: movieScenes,
        elements
    };
}

export async function POST(request: NextRequest) {
    let jobId: string | null = null;

    try {
        let body;
        try {
            body = await request.json();
        } catch (e) {
            console.error("Failed to parse JSON body:", e);
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        const { jobId: reqJobId } = body;
        jobId = reqJobId;

        if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

        console.log(`\n========== FACELESS JOB: ${jobId} ==========`);

        let supabase;
        try {
            supabase = getSupabaseAdmin();
        } catch (e) {
            console.error('Failed to initialize Admin Client:', e);
            const msg = e instanceof Error ? e.message : 'Unknown config error';
            return NextResponse.json({ error: 'Server Config Error', details: msg }, { status: 500 });
        }

        // Load job state
        const { data: job, error: fetchError } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (fetchError || !job) {
            console.error(`Job ${jobId} not found. Error:`, fetchError);
            console.error(`Fetch details - Code: ${fetchError?.code}, Message: ${fetchError?.message}`);
            return NextResponse.json({ error: 'Job not found', details: fetchError }, { status: 404 });
        }

        if (job.status === 'completed' || job.status === 'failed') {
            return NextResponse.json({ message: `Already ${job.status}`, status: job.status });
        }

        // Lock check
        const lockAge = Date.now() - new Date(job.updated_at).getTime();
        if (job.is_processing && lockAge < 60000) {
            console.log(`🔒 Locked (${Math.round(lockAge / 1000)}s ago), skipping`);
            return NextResponse.json({ skipped: true });
        }

        await updateJob(jobId, { status: 'processing', is_processing: true, updated_at: new Date().toISOString() });

        const { data: freshJob } = await supabase.from('video_jobs').select('*').eq('id', jobId).single();
        if (!freshJob) return NextResponse.json({ error: 'Job lost' }, { status: 404 });

        const input = freshJob.input_data as FacelessJobInputData;

        // Validation
        if (!input.scenes || input.scenes.length === 0) {
            const errorMsg = 'No scenes provided for faceless video';
            await updateJob(jobId, { status: 'failed', error: errorMsg, is_processing: false });
            return NextResponse.json({ error: errorMsg }, { status: 400 });
        }

        const totalScenes = input.scenes.length;
        const processedScenes = input.processedScenes || [];
        const currentIndex = input.currentSceneIndex || 0;

        console.log(`Status: Scene ${currentIndex + 1}/${totalScenes}`);

        // CHECK PENDING RENDER
        if (input.pendingRender) {
            const { projectId } = input.pendingRender;
            console.log(`Checking render: ${projectId}`);

            const status = await pollJson2Video(projectId);

            if (status.completed) {
                const totalDuration = processedScenes.reduce((acc, s) => acc + s.duration, 0);
                console.log(`✅ Video completed: ${status.videoUrl}`);

                // Collect assets from processed scenes
                const sceneAssets = processedScenes.map(s => ({
                    url: s.assetUrl,
                    source: 'collected',
                    text: s.text
                }));

                // Save to permanent 'videos' table FIRST (to avoid race condition with frontend polling)
                try {
                    const script = processedScenes.map(s => s.text).join('\n\n');
                    await supabase.from('videos').insert({
                        user_id: job.user_uuid || job.user_id,
                        video_url: status.videoUrl,
                        script: script,
                        mode: 'faceless',
                        topic: '', // Could extract from input if available
                        duration: Math.round(totalDuration),
                        has_captions: input.enableCaptions || false,
                        has_music: input.enableBackgroundMusic || false,
                        assets: sceneAssets,
                        thumbnail_url: processedScenes[0]?.assetUrl || null
                    });
                    console.log('✅ Video saved to history');
                } catch (saveErr) {
                    console.error('Failed to save video to history:', saveErr);
                }

                // Update job status
                await updateJob(jobId, {
                    status: 'completed',
                    progress: 100,
                    is_processing: false,
                    progress_message: 'Video ready!',
                    result_data: {
                        videoUrl: status.videoUrl,
                        duration: totalDuration,
                        assets: sceneAssets
                    }
                });

                return NextResponse.json({ completed: true, videoUrl: status.videoUrl });
            } else if (status.failed) {
                console.error(`❌ Render failed: ${status.status}`);
                await updateJob(jobId, { status: 'failed', error: status.status, is_processing: false });
                return NextResponse.json({ failed: true, error: status.status });
            } else {
                console.log('⏳ Still rendering...');
                await updateJob(jobId, {
                    is_processing: false,
                    progress_message: status.status ? `Rendering: ${status.status}` : 'Rendering final video...'
                });
                return NextResponse.json({ completed: false, status: status.status });
            }
        }

        // PROCESS SCENES
        if (currentIndex < totalScenes) {
            const sceneInput = input.scenes[currentIndex];
            console.log(`Processing scene ${currentIndex + 1}: "${sceneInput.text.substring(0, 20)}..."`);

            try {
                // 1. Upload Image if needed
                let assetUrl = sceneInput.assetUrl;
                if (assetUrl.startsWith('data:')) {
                    console.log('  📤 Uploading asset...');
                    assetUrl = await uploadBase64Image(assetUrl, jobId, currentIndex);
                }

                // 2. Generate TTS
                console.log('  🎤 Generating TTS...');
                const { audioUrl, duration } = await generateSceneTTS(sceneInput.text, input.voiceId);

                // 3. Save processed scene
                processedScenes.push({
                    index: currentIndex,
                    text: sceneInput.text,
                    assetUrl,
                    audioUrl,
                    duration
                });

                // 4. Update job state
                const nextIndex = currentIndex + 1;
                const progress = Math.min(90, Math.floor((nextIndex / totalScenes) * 90));

                await updateJob(jobId, {
                    input_data: { ...input, processedScenes, currentSceneIndex: nextIndex },
                    progress,
                    progress_message: `Processed scene ${nextIndex} of ${totalScenes}`,
                    is_processing: false // Release lock immediately to allow next poll
                });

                console.log(`✅ Scene ${currentIndex + 1} processed`);
                return NextResponse.json({ processed: true, sceneIndex: currentIndex });

            } catch (err) {
                console.error(`❌ Scene ${currentIndex} failed:`, err);
                await updateJob(jobId, { status: 'failed', error: String(err), is_processing: false });
                return NextResponse.json({ error: String(err) }, { status: 500 });
            }
        }

        // ALL SCENES PROCESSED - START RENDER
        console.log('🎬 All scenes ready. Building video payload...');
        const moviePayload = buildJson2VideoPayload(
            processedScenes,
            input.aspectRatio,
            input.enableBackgroundMusic || false,
            input.backgroundMusicUrl,
            input.enableCaptions || false,
            input.captionStyle,
            input.allAssets || []
        );

        const projectId = await startJson2VideoRender(moviePayload);

        // Save pending render state
        await updateJob(jobId, {
            progress: 95,
            progress_message: 'Rendering video...',
            input_data: { ...input, processedScenes, pendingRender: { projectId, startedAt: Date.now() } },
            is_processing: false
        });

        // Trigger an immediate check
        return NextResponse.json({ rendering: true, projectId });

    } catch (e) {
        console.error('Process error:', e);
        if (jobId) await updateJob(jobId!, { is_processing: false, error: String(e) });
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
