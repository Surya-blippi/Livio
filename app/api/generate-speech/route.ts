import { fal } from '@fal-ai/client';
import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits } from '@/lib/supabase';
import { calculateAudioCredits } from '@/lib/credits';

// Chatterbox language type
type ChatterboxLanguage = 'english' | 'arabic' | 'danish' | 'german' | 'greek' | 'spanish' | 'finnish' | 'french' | 'hebrew' | 'hindi' | 'italian' | 'japanese' | 'korean' | 'malay' | 'dutch' | 'norwegian' | 'polish' | 'portuguese' | 'russian' | 'swedish' | 'swahili' | 'turkish' | 'chinese';

/**
 * Chunk text for Chatterbox (max 300 chars per API call)
 */
function chunkText(text: string, maxChars = 280): string[] {
    if (text.length <= maxChars) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxChars) {
            chunks.push(remaining.trim());
            break;
        }

        let breakPoint = maxChars;
        const sentenceEnd = remaining.slice(0, maxChars).lastIndexOf('. ');
        const exclamEnd = remaining.slice(0, maxChars).lastIndexOf('! ');
        const questEnd = remaining.slice(0, maxChars).lastIndexOf('? ');
        const bestSentenceBreak = Math.max(sentenceEnd, exclamEnd, questEnd);

        if (bestSentenceBreak > maxChars / 2) {
            breakPoint = bestSentenceBreak + 1;
        } else {
            const commaBreak = remaining.slice(0, maxChars).lastIndexOf(', ');
            if (commaBreak > maxChars / 2) {
                breakPoint = commaBreak + 1;
            } else {
                const spaceBreak = remaining.slice(0, maxChars).lastIndexOf(' ');
                if (spaceBreak > 0) breakPoint = spaceBreak;
            }
        }

        chunks.push(remaining.slice(0, breakPoint).trim());
        remaining = remaining.slice(breakPoint).trim();
    }

    return chunks;
}

/**
 * Generate TTS using Chatterbox Multilingual with zero-shot voice cloning
 * 
 * Parameter tuning for natural voice cloning:
 * - exaggeration (0.25-2.0): Controls expressiveness. 0.5 is neutral, higher = more expressive
 * - temperature (0.05-5.0): Controls variation. Higher = more varied speech patterns
 * - cfg_scale (0.0-1.0): Guidance strength. LOWER values work better for voice cloning
 */
async function generateChatterboxTTS(
    text: string,
    voiceSampleUrl: string,
    language: ChatterboxLanguage = 'english'
): Promise<{ audioUrl: string }> {
    const result = await fal.subscribe('fal-ai/chatterbox/text-to-speech/multilingual', {
        input: {
            text,
            voice: voiceSampleUrl,
            custom_audio_language: language,
            // Tuned parameters for natural voice cloning:
            exaggeration: 0.65,    // Slightly more expressive - less robotic
            temperature: 0.7,      // Slightly lower variation - more consistent
            cfg_scale: 0.15        // Much lower guidance - better voice matching
        },
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
                console.log('TTS progress:', update.logs?.map((log: { message: string }) => log.message));
            }
        }
    }) as unknown as { data: { audio: { url: string } } };

    if (!result.data?.audio?.url) {
        throw new Error('No audio URL returned from Chatterbox TTS');
    }

    return { audioUrl: result.data.audio.url };
}

export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { script, voiceSampleUrl, customVoiceId, language = 'english' } = body;

        if (!script) {
            return NextResponse.json(
                { error: 'Script is required' },
                { status: 400 }
            );
        }

        // Determine voice sample URL (accept either new voiceSampleUrl or legacy customVoiceId)
        // If customVoiceId looks like a URL, use it; otherwise we need voiceSampleUrl
        let sampleUrl = voiceSampleUrl;
        if (!sampleUrl && customVoiceId) {
            // Check if customVoiceId is actually a URL (for backward compatibility)
            if (customVoiceId.startsWith('http')) {
                sampleUrl = customVoiceId;
            } else {
                // Old MiniMax voice IDs won't work with Chatterbox
                // Use default sample voice
                console.warn('Legacy voice_id detected, using default voice sample');
                sampleUrl = 'https://storage.googleapis.com/chatterbox-demo-samples/prompts/male_old_movie.flac';
            }
        }

        if (!sampleUrl) {
            // Use default voice if no sample provided
            sampleUrl = 'https://storage.googleapis.com/chatterbox-demo-samples/prompts/male_old_movie.flac';
        }

        // 1. Check credits
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

        const cost = calculateAudioCredits(script.length);
        const hasCredits = await hasEnoughCredits(user.id, cost);

        if (!hasCredits) {
            return NextResponse.json({
                error: `Insufficient credits. Speech generation requires ${cost} credits.`,
                code: 'INSUFFICIENT_CREDITS'
            }, { status: 402 });
        }

        console.log('Generating speech with Chatterbox:', {
            scriptLength: script.length,
            voiceSample: sampleUrl.substring(0, 50) + '...',
            language
        });

        // 2. Chunk text if needed and generate TTS
        const chunks = chunkText(script);
        console.log(`Text split into ${chunks.length} chunk(s)`);

        const audioUrls: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
            console.log(`Generating chunk ${i + 1}/${chunks.length}`);
            const result = await generateChatterboxTTS(chunks[i], sampleUrl, language as ChatterboxLanguage);
            audioUrls.push(result.audioUrl);
        }

        // For now, return the first audio URL
        // TODO: Implement audio concatenation for multi-chunk scripts
        const audioUrl = audioUrls[0];

        // Estimate duration: ~150 words per minute, avg 5 chars per word
        const estimatedDurationMs = (script.length / 5 / 150) * 60 * 1000;

        // 3. Deduct credits
        await deductCredits(user.id, cost, 'Generated Speech (Chatterbox)', {
            charCount: script.length,
            chunks: chunks.length,
            language
        });

        console.log(`✅ Speech generated: ${audioUrl}`);

        return NextResponse.json({
            audioUrl,
            durationMs: Math.max(estimatedDurationMs, 1000)
        });

    } catch (error: unknown) {
        console.error('Error generating speech:', error);

        let errorMessage = 'Failed to generate speech';
        let errorDetails = null;

        if (error instanceof Error) {
            errorMessage = error.message;
        }

        if (typeof error === 'object' && error !== null) {
            errorDetails = error;
        }

        return NextResponse.json(
            {
                error: errorMessage,
                details: errorDetails
            },
            { status: 500 }
        );
    }
}
