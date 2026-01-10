import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/lib/supabase';

// No timeout needed - webhook is called by WaveSpeed, not polled
export const maxDuration = 60;

// WaveSpeed webhook payload structure
interface WaveSpeedWebhookPayload {
    id: string;              // predictionId
    model: string;
    input: Record<string, unknown>;
    outputs?: string[];      // Video URLs when completed
    urls: {
        get: string;
    };
    has_nsfw_contents?: boolean[];
    status: 'completed' | 'failed';
    created_at: string;
    error?: string;          // Error message when failed
}

// Pending scene state (must match process route)
interface PendingSceneState {
    predictionId: string;
    sceneIndex: number;
    audioUrl: string;
    duration: number;
    text: string;
    startedAt: number;
}

// Processed scene structure
interface ProcessedScene {
    index: number;
    type: 'face' | 'asset';
    clipUrl: string;
    audioUrl?: string;
    duration: number;
    text: string;
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
            return videoUrl; // Fallback to WaveSpeed URL
        }

        const { data: publicUrl } = supabase.storage
            .from('videos')
            .getPublicUrl(`clips/${fileName}`);

        console.log(`✅ Uploaded to Supabase: ${publicUrl.publicUrl}`);
        return publicUrl.publicUrl;
    } catch (err) {
        console.error('❌ Failed to upload to Supabase:', err);
        return videoUrl; // Fallback to WaveSpeed URL
    }
}

export async function POST(request: NextRequest) {
    console.log('🔔 WaveSpeed webhook received');

    try {
        const payload = await request.json() as WaveSpeedWebhookPayload;

        console.log(`📦 Webhook payload:`, JSON.stringify({
            id: payload.id,
            status: payload.status,
            outputs: payload.outputs?.length || 0,
            error: payload.error
        }));

        const { id: predictionId, status, outputs, error: wavespeedError } = payload;

        if (!predictionId) {
            console.error('❌ Missing prediction ID in webhook');
            return NextResponse.json({ error: 'Missing prediction ID' }, { status: 400 });
        }

        // Find the job with this predictionId in pendingScene
        // We need to search through jobs with pending scenes
        const { data: jobs, error: fetchError } = await supabase
            .from('video_jobs')
            .select('*')
            .eq('status', 'processing')
            .not('input_data->pendingScene', 'is', null);

        if (fetchError) {
            console.error('❌ Failed to fetch jobs:', fetchError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        // Find the job with matching predictionId
        const job = jobs?.find(j => {
            const inputData = j.input_data as { pendingScene?: PendingSceneState };
            return inputData.pendingScene?.predictionId === predictionId;
        });

        if (!job) {
            console.warn(`⚠️ No job found for prediction ID: ${predictionId}`);
            // Return 200 anyway to prevent WaveSpeed from retrying
            return NextResponse.json({
                message: 'No matching job found',
                predictionId
            });
        }

        console.log(`🎯 Found job ${job.id} for prediction ${predictionId}`);

        const inputData = job.input_data as {
            scenes: Array<{ text: string; type: 'face' | 'asset'; assetUrl?: string }>;
            faceImageUrl: string;
            voiceId: string;
            enableBackgroundMusic: boolean;
            enableCaptions: boolean;
            pendingScene: PendingSceneState;
        };

        const pendingScene = inputData.pendingScene;
        const processedScenes: ProcessedScene[] = job.processed_scenes || [];
        const totalScenes = inputData.scenes.length;

        if (status === 'failed') {
            console.error(`❌ WaveSpeed failed for scene ${pendingScene.sceneIndex + 1}:`, wavespeedError);

            // Clear pending scene so it can be retried
            const updatedInputData = { ...inputData, pendingScene: null };

            await supabase
                .from('video_jobs')
                .update({
                    input_data: updatedInputData,
                    progress_message: `Face video generation failed, will retry...`,
                    is_processing: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', job.id);

            return NextResponse.json({
                message: 'Scene failed, marked for retry',
                jobId: job.id
            });
        }

        if (status === 'completed' && outputs && outputs.length > 0) {
            const videoUrl = outputs[0];
            console.log(`✅ WaveSpeed completed for scene ${pendingScene.sceneIndex + 1}: ${videoUrl}`);

            // Upload to Supabase storage
            const fileName = `clip_${job.id}_scene_${pendingScene.sceneIndex}.mp4`;
            const clipUrl = await uploadClipToSupabase(videoUrl, fileName);

            // Create processed scene entry
            const newProcessedScene: ProcessedScene = {
                index: pendingScene.sceneIndex,
                type: 'face',
                clipUrl,
                duration: pendingScene.duration,
                text: pendingScene.text
            };

            processedScenes.push(newProcessedScene);

            // Clear pending scene and advance to next
            const updatedInputData = { ...inputData, pendingScene: null };
            const newSceneIndex = pendingScene.sceneIndex + 1;
            const progress = Math.floor(10 + (newSceneIndex / totalScenes) * 70);

            await supabase
                .from('video_jobs')
                .update({
                    current_scene_index: newSceneIndex,
                    processed_scenes: processedScenes,
                    input_data: updatedInputData,
                    progress,
                    progress_message: newSceneIndex >= totalScenes
                        ? 'All scenes complete, composing video...'
                        : `Scene ${newSceneIndex}/${totalScenes} complete`,
                    is_processing: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', job.id);

            console.log(`✅ Scene ${pendingScene.sceneIndex + 1} saved. Next: ${newSceneIndex + 1}/${totalScenes}`);

            return NextResponse.json({
                success: true,
                message: `Scene ${pendingScene.sceneIndex + 1} processed`,
                jobId: job.id,
                nextScene: newSceneIndex + 1
            });
        }

        // Unknown status
        console.warn(`⚠️ Unknown webhook status: ${status}`);
        return NextResponse.json({
            message: 'Webhook received but status unknown',
            status
        });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        return NextResponse.json(
            { error: `Webhook error: ${error instanceof Error ? error.message : 'Unknown'}` },
            { status: 500 }
        );
    }
}

// Handle GET requests for testing
export async function GET() {
    return NextResponse.json({
        message: 'WaveSpeed webhook endpoint is active',
        timestamp: new Date().toISOString()
    });
}
