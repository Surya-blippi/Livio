import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { fal } from '@fal-ai/client';
import { supabase } from '@/lib/supabase';
import { convertFaceVideoToJson2VideoFormat, FaceSceneInput } from '@/lib/json2video';

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

// Generate TTS for a single scene using fal.ai
async function generateSceneTTS(text: string, voiceId: string): Promise<{ audioUrl: string; duration: number }> {
    console.log(`  [TTS] Generating for: "${text.substring(0, 50)}..."`);

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
    const duration = durationMs / 1000;

    console.log(`  [TTS] Generated ${duration.toFixed(2)}s audio`);

    return {
        audioUrl: result.data.audio.url,
        duration
    };
}

// Generate WaveSpeed face video and return the video URL
async function generateFaceVideoClip(
    imageDataUrl: string,
    audioUrl: string
): Promise<string> {
    console.log(`  [WaveSpeed] Generating face video clip...`);

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
            if (pollData.outputs && pollData.outputs.length > 0) {
                videoUrl = pollData.outputs[0];
                break;
            }
        } catch (err) {
            console.warn(`  [WaveSpeed] Poll ${i + 1} failed, retrying...`);
        }
    }

    if (!videoUrl) {
        throw new Error('WaveSpeed timeout - no video generated');
    }

    console.log(`  [WaveSpeed] ✅ Face video clip complete`);
    return videoUrl;
}

// Upload video to Supabase Storage and return public URL
async function uploadClipToSupabase(
    videoUrl: string,
    fileName: string
): Promise<string> {
    console.log(`  [Supabase] Uploading clip: ${fileName}`);

    // Download the video
    const videoResponse = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 120000
    });

    // Upload to Supabase Storage (face-clips bucket)
    const { data, error } = await supabase.storage
        .from('face-clips')
        .upload(fileName, Buffer.from(videoResponse.data), {
            contentType: 'video/mp4',
            upsert: true
        });

    if (error) {
        console.error('  [Supabase] Upload error:', error);
        // If bucket doesn't exist or upload fails, return original URL
        return videoUrl;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
        .from('face-clips')
        .getPublicUrl(data.path);

    console.log(`  [Supabase] ✅ Uploaded: ${publicUrlData.publicUrl}`);
    return publicUrlData.publicUrl;
}

// Call JSON2Video API to render the final video
async function renderWithJson2Video(
    moviePayload: Json2VideoMovie
): Promise<{ videoUrl: string; duration: number }> {
    console.log('[JSON2Video] Starting render...');

    // Start render
    const renderResponse = await axios.post(
        'https://api.json2video.com/v2/movies',
        moviePayload,
        {
            headers: {
                'x-api-key': JSON2VIDEO_API_KEY,
                'Content-Type': 'application/json'
            }
        }
    );

    const projectId = renderResponse.data.project;
    console.log(`[JSON2Video] Project ID: ${projectId}`);

    // Poll for completion
    const maxPolls = 120; // 10 minutes max
    for (let i = 0; i < maxPolls; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statusResponse = await axios.get(
            `https://api.json2video.com/v2/movies?project=${projectId}`,
            {
                headers: { 'x-api-key': JSON2VIDEO_API_KEY }
            }
        );

        const status = statusResponse.data.movie?.status;
        console.log(`[JSON2Video] Status: ${status}`);

        if (status === 'done') {
            const videoUrl = statusResponse.data.movie.url;
            const duration = statusResponse.data.movie.duration || 30;
            console.log(`[JSON2Video] ✅ Complete: ${videoUrl}`);
            return { videoUrl, duration };
        }

        if (status === 'error') {
            throw new Error(`JSON2Video render failed: ${statusResponse.data.movie?.message}`);
        }
    }

    throw new Error('JSON2Video render timed out');
}

export async function POST(request: NextRequest) {
    try {
        const {
            scenes,
            faceImageUrl,
            voiceId,
            enableBackgroundMusic,
            enableCaptions
        } = await request.json() as {
            scenes: SceneInput[];
            faceImageUrl: string;
            voiceId: string;
            enableBackgroundMusic?: boolean;
            enableCaptions?: boolean;
        };

        if (!scenes || scenes.length === 0 || !faceImageUrl || !voiceId) {
            return NextResponse.json(
                { error: 'Missing required fields: scenes, faceImageUrl, voiceId' },
                { status: 400 }
            );
        }

        console.log('🎬 Face video generation with JSON2Video:');
        console.log(`  - Scenes: ${scenes.length}`);
        console.log(`  - Face scenes: ${scenes.filter(s => s.type === 'face').length}`);
        console.log(`  - Asset scenes: ${scenes.filter(s => s.type === 'asset').length}`);

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

        // Process each scene
        const faceScenes: FaceSceneInput[] = [];
        const clipAssets: { url: string; source: string }[] = [];
        const timestamp = Date.now();

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            console.log(`\n📍 Scene ${i + 1}/${scenes.length}: ${scene.type.toUpperCase()}`);

            // 1. Generate TTS for this scene
            const { audioUrl, duration } = await generateSceneTTS(scene.text, voiceId);

            // 2. Generate video clip or use asset
            let clipUrl: string;
            let sceneAudioUrl: string | undefined;

            if (scene.type === 'face') {
                // Generate WaveSpeed face video (audio is baked into video)
                const wavespeedUrl = await generateFaceVideoClip(imageDataUrl, audioUrl);

                // Upload to Supabase Storage
                const fileName = `clip_${timestamp}_scene_${i}.mp4`;
                clipUrl = await uploadClipToSupabase(wavespeedUrl, fileName);

                clipAssets.push({ url: clipUrl, source: 'wavespeed' });
                // No separate audio needed for face scenes (audio in video)
            } else {
                // For asset scenes, use the asset image directly
                clipUrl = scene.assetUrl || faceImageUrl;
                // Asset scenes need separate audio
                sceneAudioUrl = audioUrl;
            }

            faceScenes.push({
                url: clipUrl,
                duration,
                text: scene.text,
                sceneType: scene.type,  // 'face' or 'asset'
                audioUrl: sceneAudioUrl  // Only for asset scenes
            });
        }

        // 3. Build JSON2Video payload
        const moviePayload = convertFaceVideoToJson2VideoFormat({
            scenes: faceScenes,
            enableCaptions: enableCaptions ?? true,
            captionStyle: 'bold-classic',
            enableBackgroundMusic: enableBackgroundMusic ?? false,
        });

        console.log('\n[JSON2Video] Movie payload:', JSON.stringify(moviePayload, null, 2));

        // 4. Render with JSON2Video
        const { videoUrl, duration } = await renderWithJson2Video(moviePayload);

        console.log('\n🎬 Face video complete!');
        console.log(`   Duration: ${duration}s`);
        console.log(`   Clip assets saved: ${clipAssets.length}`);

        return NextResponse.json({
            videoUrl,
            duration,
            clipAssets  // Return the saved clip URLs for asset storage
        });

    } catch (error) {
        console.error('Error in face video:', error);
        return NextResponse.json(
            { error: `Failed to generate face video: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
