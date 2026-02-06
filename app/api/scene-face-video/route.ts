import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { fal } from '@fal-ai/client';
import { supabase, getOrCreateUser, getUserCredits, deductCredits } from '@/lib/supabase';
import { convertFaceVideoToJson2VideoFormat, FaceSceneInput, Json2VideoMovie } from '@/lib/json2video';
import { auth, currentUser } from '@clerk/nextjs/server';
import { CREDIT_COSTS } from '@/lib/credits';
import { cloneVoiceWithQwen, generateSpeechWithQwen } from '@/lib/fal';

fal.config({
    credentials: process.env.FAL_KEY
});

const WAVESPEED_API_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk';
const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || process.env.NEXT_PUBLIC_WAVESPEED_API_KEY!;
const JSON2VIDEO_API_KEY = process.env.JSON2VIDEO_API_KEY!;

export const maxDuration = 60;

interface SceneInput {
    text: string;
    type: 'face' | 'asset';
    assetUrl?: string;
}

/**
 * Helper: Clone voice via Qwen (JIT)
 */
async function cloneVoiceWithQwenForUser(audioUrl: string, userId: string): Promise<string> {
    console.log('🧬 JIT Cloning: Calling Qwen voice-clone API...');
    const { embeddingUrl } = await cloneVoiceWithQwen(audioUrl);
    console.log('✓ Qwen voice clone result:', embeddingUrl);
    return embeddingUrl;
}

// Generate TTS for a single scene using Qwen
async function generateSceneTTS(
    text: string,
    embeddingUrl: string
): Promise<{ audioUrl: string; duration: number }> {
    console.log(`  [TTS] Generating for: "${text.substring(0, 50)}..." with Qwen TTS`);

    // Use lib/fal helper which handles chunking and Qwen API
    const result = await generateSpeechWithQwen(text, {
        embeddingUrl
    });

    console.log(`  [TTS] Generated ~${result.duration.toFixed(2)}s audio`);

    return {
        audioUrl: result.audioUrl,
        duration: result.duration
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
        // === AUTHENTICATION ===
        const { userId: clerkUserId } = await auth();
        if (!clerkUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 401 });
        }

        // Get or create user in Supabase
        const dbUser = await getOrCreateUser(
            clerkUserId,
            user.emailAddresses[0]?.emailAddress || '',
            user.firstName || user.username || 'User'
        );

        if (!dbUser) {
            return NextResponse.json({ error: 'Failed to verify user' }, { status: 500 });
        }

        const {
            scenes,
            faceImageUrl,
            voiceId,
            voiceSampleUrl,
            enableBackgroundMusic,
            enableCaptions
        } = await request.json() as {
            scenes: SceneInput[];
            faceImageUrl: string;
            voiceId?: string; // Deprecated
            voiceSampleUrl?: string; // Deprecated
            enableBackgroundMusic?: boolean;
            enableCaptions?: boolean;
        };

        // Look up qwen_embedding_url using voice_sample_url
        const { data: voiceData } = await supabase
            .from('voices')
            .select('qwen_embedding_url, voice_sample_url')
            .eq('user_id', dbUser.id)
            .eq('is_active', true)
            .single();

        let embeddingUrl = voiceData?.qwen_embedding_url;

        // JIT Cloning Logic: If we have a sample URL but no Qwen embedding, clone it now!
        if (!embeddingUrl && voiceData?.voice_sample_url) {
            console.log('⚠️ No Qwen embedding found, but voice sample exists. Triggering JIT cloning...');
            try {
                embeddingUrl = await cloneVoiceWithQwenForUser(voiceData.voice_sample_url, dbUser.id);

                // Save the new ID to the database so we don't clone again
                await supabase
                    .from('voices')
                    .update({ qwen_embedding_url: embeddingUrl })
                    .eq('user_id', dbUser.id)
                    .eq('is_active', true);

                console.log('✅ JIT Cloning successful. Saved new embedding:', embeddingUrl);
            } catch (cloneError) {
                console.error('❌ JIT Cloning failed:', cloneError);
                // Fall through to error
            }
        }

        if (!embeddingUrl) {
            return NextResponse.json({
                error: 'No cloned voice found. Please upload a voice sample first.',
                code: 'NO_VOICE'
            }, { status: 400 });
        }

        if (!scenes || scenes.length === 0 || !faceImageUrl) {
            return NextResponse.json(
                { error: 'Missing required fields: scenes, faceImageUrl' },
                { status: 400 }
            );
        }

        // === CREDIT CALCULATION ===
        const faceSceneCount = scenes.filter(s => s.type === 'face').length;
        const faceSceneCredits = faceSceneCount * CREDIT_COSTS.FACE_VIDEO_SCENE;
        const renderCredits = CREDIT_COSTS.VIDEO_RENDER;
        const totalCreditsNeeded = faceSceneCredits + renderCredits;

        console.log('🎬 Face video generation with JSON2Video:');
        console.log(`  - Scenes: ${scenes.length}`);
        console.log(`  - Face scenes: ${faceSceneCount} (${faceSceneCredits} credits)`);
        console.log(`  - Asset scenes: ${scenes.filter(s => s.type === 'asset').length}`);
        console.log(`  - Render credits: ${renderCredits}`);
        console.log(`  - Total credits needed: ${totalCreditsNeeded}`);

        // Check if user has enough credits
        const userCredits = await getUserCredits(dbUser.id);
        if (!userCredits || userCredits.balance < totalCreditsNeeded) {
            const currentBalance = userCredits?.balance || 0;
            return NextResponse.json(
                {
                    error: `Insufficient credits. Need ${totalCreditsNeeded}, have ${currentBalance}`,
                    creditsNeeded: totalCreditsNeeded,
                    currentBalance
                },
                { status: 402 }
            );
        }

        console.log(`  ✅ Credit check passed (have ${userCredits.balance})`);

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

            // 1. Generate TTS for this scene using Qwen
            const { audioUrl, duration } = await generateSceneTTS(scene.text, embeddingUrl);

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

        // === DEDUCT CREDITS AFTER SUCCESSFUL RENDER ===
        const deductResult = await deductCredits(
            dbUser.id,
            totalCreditsNeeded,
            `Face video generation (${faceSceneCount} scenes + render)`,
            {
                faceSceneCount,
                faceSceneCredits,
                renderCredits,
                totalScenes: scenes.length,
                duration
            }
        );

        if (!deductResult.success) {
            console.error('Failed to deduct credits:', deductResult.error);
            // Video was created, log warning but don't fail
        } else {
            console.log(`  💳 Credits deducted: ${totalCreditsNeeded} (new balance: ${deductResult.balance})`);
        }

        console.log('\n🎬 Face video complete!');
        console.log(`   Duration: ${duration}s`);
        console.log(`   Clip assets saved: ${clipAssets.length}`);
        console.log(`   Credits used: ${totalCreditsNeeded}`);

        return NextResponse.json({
            videoUrl,
            duration,
            clipAssets,
            creditsUsed: totalCreditsNeeded,
            creditsRemaining: deductResult.balance
        });

    } catch (error) {
        console.error('Error in face video:', error);
        return NextResponse.json(
            { error: `Failed to generate face video: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
