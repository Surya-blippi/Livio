import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits, supabase } from '@/lib/supabase';
import { calculateAudioCredits } from '@/lib/credits';

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY;

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
    console.log('MiniMax TTS result:', result.status);

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
        const { data: voiceData } = await supabase
            .from('voices')
            .select('minimax_voice_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single();

        if (!voiceData?.minimax_voice_id) {
            return NextResponse.json({
                error: 'No cloned voice found. Please upload a voice sample first.',
                code: 'NO_VOICE'
            }, { status: 400 });
        }

        const minimaxVoiceId = voiceData.minimax_voice_id;
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
