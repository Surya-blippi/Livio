import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { generateSceneTTS } from '@/lib/fal';
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
}

// Update job in Supabase
async function updateJob(jobId: string, updates: Record<string, unknown>) {
    const { error } = await supabase
        .from('video_jobs')
        .update(updates)
        .eq('id', jobId);
    if (error) console.error(`Failed to update job ${jobId}:`, error);
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

        const { error } = await supabase.storage
            .from('videos')
            .upload(fileName, buffer, {
                contentType,
                upsert: true
            });

        if (error) {
            console.error('Upload error:', error);
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

// Build JSON2Video movie payload
function buildJson2VideoPayload(scenes: ProcessedScene[], aspectRatio: '9:16' | '16:9' | '1:1', enableBgMusic: boolean, bgMusicUrl?: string): Json2VideoMovie {
    const dimensions: Record<string, { width: number; height: number }> = {
        '9:16': { width: 1080, height: 1920 },
        '16:9': { width: 1920, height: 1080 },
        '1:1': { width: 1080, height: 1080 }
    };
    const { width, height } = dimensions[aspectRatio] || { width: 1080, height: 1920 };

    const movieScenes: Json2VideoScene[] = scenes.map((scene, i) => {
        // Ken Burns Effect
        const effects = [
            { zoom: { start: 1.0, end: 1.15 } },
            { zoom: { start: 1.15, end: 1.0 } },
            { zoom: { start: 1.0, end: 1.2 }, pan: { start: 'center', end: 'top-left' } },
            { zoom: { start: 1.2, end: 1.0 }, pan: { start: 'top-right', end: 'center' } },
        ];
        const effect = effects[i % effects.length];

        return {
            comment: scene.text.substring(0, 50),
            duration: scene.duration,
            elements: [
                {
                    type: 'image',
                    src: scene.assetUrl,
                    resize: 'cover',
                    ...effect
                },
                {
                    type: 'audio',
                    src: scene.audioUrl,
                    volume: 1.0
                }
            ]
        };
    });

    // Add background music if enabled
    const elements: any[] = [];
    if (enableBgMusic && bgMusicUrl) {
        elements.push({
            type: 'audio',
            src: bgMusicUrl,
            volume: 0.15,
            loop: true
        });
    }

    return {
        resolution: aspectRatio === '16:9' ? 'full-hd' : 'full-hd-vertical',
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
        console.log(`Debug: Service Key Present? ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
        console.log(`Debug: Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

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

        await updateJob(jobId, { is_processing: true, updated_at: new Date().toISOString() });

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

                await updateJob(jobId, {
                    status: 'completed',
                    progress: 100,
                    is_processing: false,
                    result_data: { videoUrl: status.videoUrl, duration: totalDuration }
                });
                return NextResponse.json({ completed: true, videoUrl: status.videoUrl });
            } else if (status.failed) {
                console.error(`❌ Render failed: ${status.status}`);
                await updateJob(jobId, { status: 'failed', error: status.status, is_processing: false });
                return NextResponse.json({ failed: true, error: status.status });
            } else {
                console.log('⏳ Still rendering...');
                await updateJob(jobId, { is_processing: false });
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
        const moviePayload = buildJson2VideoPayload(processedScenes, input.aspectRatio, input.enableBackgroundMusic, input.backgroundMusicUrl);

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
