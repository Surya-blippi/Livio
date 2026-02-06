import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits, supabase } from '@/lib/supabase';
import { calculateAudioCredits } from '@/lib/credits';
import { fal } from '@fal-ai/client';

const FAL_KEY = process.env.FAL_KEY;

function chunkText(text: string, maxChars: number = 800): string[] {
    if (text.length <= maxChars) {
        return [text];
    }

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
                if (spaceBreak > 0) {
                    breakPoint = spaceBreak;
                }
            }
        }

        chunks.push(remaining.slice(0, breakPoint).trim());
        remaining = remaining.slice(breakPoint).trim();
    }

    return chunks;
}

export async function POST(request: NextRequest) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        if (!FAL_KEY) {
            console.error('FAL_KEY is missing');
            return NextResponse.json({ error: 'Server configuration error: Missing API Key' }, { status: 500 });
        }

        const body = await request.json();
        const { text, embedding_url, reference_text, voice, language } = body;

        if (!text) {
            return NextResponse.json(
                { error: 'text is required' },
                { status: 400 }
            );
        }

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

        const cost = calculateAudioCredits(text.length);
        const hasCredits = await hasEnoughCredits(user.id, cost);

        if (!hasCredits) {
            return NextResponse.json({
                error: `Insufficient credits. Speech generation requires ${cost} credits.`,
                code: 'INSUFFICIENT_CREDITS'
            }, { status: 402 });
        }

        console.log('🎤 Qwen 3 TTS: Generating speech');

        const chunks = chunkText(text);
        console.log(`📝 Text split into ${chunks.length} chunk(s)`);

        const audioUrls: string[] = [];
        let totalDuration = 0;

        for (let i = 0; i < chunks.length; i++) {
            console.log(`  Chunk ${i + 1}/${chunks.length}: "${chunks[i].substring(0, 50)}..."`);

            const result = await fal.subscribe(
                'fal-ai/qwen-3-tts/text-to-speech/1.7b',
                {
                    input: {
                        text: chunks[i],
                        voice: voice || 'Vivian',
                        language: language || 'Auto',
                        speaker_voice_embedding_file_url: embedding_url || undefined,
                        reference_text: reference_text || undefined
                    },
                    logs: false
                }
            ) as {
                audio?: {
                    url?: string;
                    duration?: number;
                    file_name?: string;
                };
            };

            if (result.audio?.url) {
                audioUrls.push(result.audio.url);
                totalDuration += result.audio.duration || 0;
            }
        }

        if (audioUrls.length === 0) {
            throw new Error('No audio generated from Qwen TTS');
        }

        console.log(`✅ Qwen TTS generated: ${audioUrls.length} audio segment(s)`);

        await deductCredits(user.id, cost, 'Qwen TTS Generation', {
            charCount: text.length,
            chunks: chunks.length,
            embedding_url: embedding_url || null,
            voice: voice || null
        });

        return NextResponse.json({
            audioUrl: audioUrls[0],
            audioUrls: audioUrls.length > 1 ? audioUrls : undefined,
            duration: totalDuration,
            cost
        });

    } catch (error: unknown) {
        console.error('Qwen TTS error:', error);

        let errorMessage = 'Speech generation failed';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
