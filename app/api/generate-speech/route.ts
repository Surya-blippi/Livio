import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits, supabase } from '@/lib/supabase';
import { calculateAudioCredits } from '@/lib/credits';

// Need fal for JIT cloning to ensure file access if needed (though we use URL directly)
import { fal } from '@fal-ai/client';

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || process.env.NEXT_PUBLIC_WAVESPEED_API_KEY;

/**
 * Helper: Clone voice via WaveSpeed MiniMax
 */
async function cloneVoiceWithMiniMax(audioUrl: string, userId: string): Promise<string> {
    const customVoiceId = `v${userId.replace(/-/g, '').substring(0, 12)}${Date.now().toString(36)}`;
    console.log('🧬 JIT Cloning: Calling WaveSpeed MiniMax voice-clone API...');

    const cloneResponse = await fetch('https://api.wavespeed.ai/api/v3/minimax/voice-clone', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            audio: audioUrl,
            custom_voice_id: customVoiceId,
            model: 'speech-02-hd',
            need_noise_reduction: true,
            language_boost: 'auto',
            text: 'Hello! This is a preview of your cloned voice.'
        })
    });

    if (!cloneResponse.ok) {
        const errorData = await cloneResponse.json();
        console.error('MiniMax clone error:', errorData);
        throw new Error(`Voice cloning failed: ${JSON.stringify(errorData)}`);
    }

    const cloneResult = await cloneResponse.json();
    console.log('✓ MiniMax voice clone result:', cloneResult);

    // Some APIs return success but with an error status in the body
    // WaveSpeed/MiniMax returns code: 200 for success
    if (cloneResult.status === 'failed' || (cloneResult.code && cloneResult.code !== 0 && cloneResult.code !== 200)) {
        throw new Error(`Voice cloning failed operation: ${JSON.stringify(cloneResult)}`);
    }

    return customVoiceId;
}

/**
 * Text chunking for long scripts
 * MiniMax supports 10,000 chars but we chunk for safety
 */
function chunkText(text: string, maxCharsPerChunk: number = 5000): string[] {
    if (text.length <= maxCharsPerChunk) {
        return [text];
    }

    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxCharsPerChunk) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            currentChunk = sentence;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

/**
 * Generate TTS using MiniMax via WaveSpeed API
 */
async function generateMiniMaxTTS(
    text: string,
    minimaxVoiceId: string
): Promise<{ audioUrl: string }> {
    console.log(`🎤 MiniMax TTS: "${text.substring(0, 50)}..." (voice: ${minimaxVoiceId})`);

    const response = await fetch('https://api.wavespeed.ai/api/v3/minimax/speech-02-hd', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text,
            voice_id: minimaxVoiceId,
            speed: 1.0,
            vol: 1.0,
            pitch: 0,
            audio_sample_rate: 24000,
            bitrate: 128000
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('MiniMax TTS error:', errorData);
        throw new Error(`MiniMax TTS failed: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    // console.log('MiniMax TTS result full:', JSON.stringify(result)); // Debug full response

    // Check for API-level errors even if HTTP 200 (common in some AI APIs)
    if (result.code && result.code !== 0 && result.msg) {
        console.error('MiniMax TTS API error:', result);
        throw new Error(`MiniMax TTS API error: ${result.msg} (Code: ${result.code})`);
    }

    // Check if result.status indicates failure
    if (result.status === 'failed') {
        throw new Error(`MiniMax TTS failed with status: ${result.status}`);
    }

    console.log('MiniMax TTS result status:', result.status || 'unknown');

    // Wait for completion if async
    if (result.status !== 'completed' && result.id) {
        const audioUrl = await pollWaveSpeedResult(result.id);
        return { audioUrl };
    }

    if (!result.outputs?.[0]) {
        throw new Error('No audio URL from MiniMax TTS');
    }

    return { audioUrl: result.outputs[0] };
}

/**
 * Poll WaveSpeed for async result completion
 */
async function pollWaveSpeedResult(predictionId: string): Promise<string> {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 1000));

        const response = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${predictionId}`, {
            headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` }
        });

        const result = await response.json();
        console.log(`Polling MiniMax TTS (${i + 1}/${maxAttempts}): ${result.status}`);

        if (result.status === 'completed' && result.outputs?.[0]) {
            return result.outputs[0];
        }
        if (result.status === 'failed') {
            throw new Error('MiniMax TTS generation failed');
        }
    }
    throw new Error('MiniMax TTS timeout');
}

export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Validate API Key
        if (!WAVESPEED_API_KEY) {
            console.error('WAVESPEED_API_KEY is missing');
            return NextResponse.json({ error: 'Server configuration error: Missing API Key' }, { status: 500 });
        }

        const body = await request.json();
        const { script } = body;

        if (!script) {
            return NextResponse.json(
                { error: 'Script is required' },
                { status: 400 }
            );
        }

        // Get user
        const currentUserData = await currentUser();
        const user = await getOrCreateUser(
            clerkId,
            currentUserData?.emailAddresses[0]?.emailAddress || '',
            currentUserData?.firstName || undefined,
            currentUserData?.imageUrl || undefined
        );

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check credits
        const cost = calculateAudioCredits(script.length);
        const hasCredits = await hasEnoughCredits(user.id, cost);

        if (!hasCredits) {
            return NextResponse.json({
                error: `Insufficient credits. Speech generation requires ${cost} credits.`,
                code: 'INSUFFICIENT_CREDITS'
            }, { status: 402 });
        }

        // Look up minimax_voice_id from voices table
        // Look up minimax_voice_id AND voice_sample_url from voices table
        const { data: voiceData } = await supabase
            .from('voices')
            .select('minimax_voice_id, voice_sample_url')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single();

        let minimaxVoiceId = voiceData?.minimax_voice_id;

        // JIT Cloning Logic: If we have a sample URL but no MiniMax ID, clone it now!
        if (!minimaxVoiceId && voiceData?.voice_sample_url) {
            console.log('⚠️ No MiniMax ID found, but voice sample exists. Triggering JIT cloning...');
            try {
                minimaxVoiceId = await cloneVoiceWithMiniMax(voiceData.voice_sample_url, user.id);

                // Save the new ID to the database so we don't clone again
                await supabase
                    .from('voices')
                    .update({ minimax_voice_id: minimaxVoiceId })
                    .eq('user_id', user.id)
                    .eq('is_active', true);

                console.log('✅ JIT Cloning successful. Saved new ID:', minimaxVoiceId);
            } catch (cloneError) {
                console.error('❌ JIT Cloning failed:', cloneError);
                // Fall through to error
            }
        }

        if (!minimaxVoiceId) {
            return NextResponse.json({
                error: 'No cloned voice found. Please upload a voice sample first.',
                code: 'NO_VOICE'
            }, { status: 400 });
        }

        // const minimaxVoiceId = voiceData.minimax_voice_id; // Already set above
        console.log('Using MiniMax voice ID:', minimaxVoiceId);

        // Generate TTS with MiniMax
        console.log('Generating speech with MiniMax TTS:', {
            scriptLength: script.length,
            voiceId: minimaxVoiceId
        });

        const chunks = chunkText(script);
        console.log(`Text split into ${chunks.length} chunk(s)`);

        const audioUrls: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
            console.log(`Generating chunk ${i + 1}/${chunks.length}`);
            const result = await generateMiniMaxTTS(chunks[i], minimaxVoiceId);
            audioUrls.push(result.audioUrl);
        }

        const audioUrl = audioUrls[0];

        // Estimate duration: ~150 words per minute, avg 5 chars per word
        const estimatedDurationMs = (script.length / 5 / 150) * 60 * 1000;

        // Deduct credits
        await deductCredits(user.id, cost, 'Generated Speech (MiniMax)', {
            charCount: script.length,
            chunks: chunks.length,
            voiceId: minimaxVoiceId
        });

        console.log(`✅ Speech generated: ${audioUrl}`);

        return NextResponse.json({
            audioUrl,
            duration: estimatedDurationMs,
            cost
        });

    } catch (error: unknown) {
        console.error('Speech generation error:', error);

        let errorMessage = 'Speech generation failed';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            {
                error: errorMessage,
                hint: 'Please try again or re-upload your voice sample.'
            },
            { status: 500 }
        );
    }
}
