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
 * Detect the language of text based on character patterns and Unicode ranges.
 * Returns the most likely Chatterbox-supported language.
 */
function detectLanguage(text: string): ChatterboxLanguage {
    const cleanText = text.replace(/[0-9\s.,!?;:'"()-]/g, '');
    if (cleanText.length === 0) return 'english';

    const charCounts = {
        arabic: 0, hebrew: 0, hindi: 0, chinese: 0,
        japanese: 0, korean: 0, greek: 0, russian: 0, latin: 0,
    };

    for (const char of cleanText) {
        const code = char.charCodeAt(0);
        if (code >= 0x0600 && code <= 0x06FF) charCounts.arabic++;
        else if (code >= 0x0590 && code <= 0x05FF) charCounts.hebrew++;
        else if (code >= 0x0900 && code <= 0x097F) charCounts.hindi++;
        else if (code >= 0x4E00 && code <= 0x9FFF) charCounts.chinese++;
        else if ((code >= 0x3040 && code <= 0x30FF) || (code >= 0x31F0 && code <= 0x31FF)) charCounts.japanese++;
        else if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF)) charCounts.korean++;
        else if (code >= 0x0370 && code <= 0x03FF) charCounts.greek++;
        else if (code >= 0x0400 && code <= 0x04FF) charCounts.russian++;
        else if (code <= 0x024F) charCounts.latin++;
    }

    const total = cleanText.length;
    const threshold = 0.3;

    if (charCounts.arabic / total > threshold) return 'arabic';
    if (charCounts.hebrew / total > threshold) return 'hebrew';
    if (charCounts.hindi / total > threshold) return 'hindi';
    if (charCounts.chinese / total > threshold) return 'chinese';
    if (charCounts.japanese / total > threshold) return 'japanese';
    if (charCounts.korean / total > threshold) return 'korean';
    if (charCounts.greek / total > threshold) return 'greek';
    if (charCounts.russian / total > threshold) return 'russian';

    // Latin-script language detection via common words
    const lowerText = text.toLowerCase();
    if (/\b(el|la|los|las|es|está|que|con|por|para|como|más|pero|muy)\b/.test(lowerText)) return 'spanish';
    if (/\b(le|la|les|est|sont|avec|pour|dans|sur|très|mais|aussi)\b/.test(lowerText)) return 'french';
    if (/\b(der|die|das|ist|sind|mit|für|auf|sehr|aber|auch|wenn)\b/.test(lowerText)) return 'german';
    if (/\b(o|a|os|as|é|são|com|para|em|muito|mas|também)\b/.test(lowerText)) return 'portuguese';
    if (/\b(il|la|i|le|è|sono|con|per|in|molto|ma|anche)\b/.test(lowerText)) return 'italian';

    return 'english';
}

/**
 * Generate TTS using F5 TTS with zero-shot voice cloning
 * 
 * F5 TTS provides excellent pronunciation quality with:
 * - Zero-shot voice cloning from reference audio
 * - Natural prosody and clear pronunciation
 * - No character limit
 */
async function generateF5TTS(
    text: string,
    voiceSampleUrl: string
): Promise<{ audioUrl: string }> {
    console.log(`🎤 F5 TTS: "${text.substring(0, 50)}..." (Voice: ${voiceSampleUrl.substring(0, 50)}...)`);

    const result = await fal.subscribe('fal-ai/f5-tts', {
        input: {
            gen_text: text,
            ref_audio_url: voiceSampleUrl,  // Reference audio for voice cloning
            ref_text: '',  // Let ASR auto-detect reference text
            model_type: 'F5-TTS',
            remove_silence: true
        },
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
                console.log('TTS progress:', update.logs?.map((log: { message: string }) => log.message));
            }
        }
    }) as unknown as { data: { audio_url: { url: string } } };

    if (!result.data?.audio_url?.url) {
        throw new Error('No audio URL returned from F5 TTS');
    }

    return { audioUrl: result.data.audio_url.url };
}

export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { script, voiceSampleUrl, customVoiceId, language } = body;  // language is now optional

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

        // Auto-detect language from script if not provided
        const detectedLang = language || detectLanguage(script);

        console.log('Generating speech with Chatterbox:', {
            scriptLength: script.length,
            voiceSample: sampleUrl.substring(0, 50) + '...',
            language: detectedLang,
            wasAutoDetected: !language
        });

        // 2. Chunk text if needed and generate TTS
        const chunks = chunkText(script);
        console.log(`Text split into ${chunks.length} chunk(s), detected language: ${detectedLang}`);

        const audioUrls: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
            console.log(`Generating chunk ${i + 1}/${chunks.length}`);
            const result = await generateF5TTS(chunks[i], sampleUrl);
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
