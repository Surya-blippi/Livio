import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits, supabase } from '@/lib/supabase';
import { calculateAudioCredits } from '@/lib/credits';
import { fal } from '@fal-ai/client';

const FAL_KEY = process.env.FAL_KEY;

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
        const { audio_url, reference_text } = body;

        if (!audio_url) {
            return NextResponse.json(
                { error: 'audio_url is required' },
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

        const cost = calculateAudioCredits(100);
        const hasCredits = await hasEnoughCredits(user.id, cost);

        if (!hasCredits) {
            return NextResponse.json({
                error: `Insufficient credits. Voice cloning requires ${cost} credits.`,
                code: 'INSUFFICIENT_CREDITS'
            }, { status: 402 });
        }

        console.log('🎙️ Qwen 3 TTS: Cloning voice from', audio_url);

        const result = await fal.subscribe(
            'fal-ai/qwen-3-tts/clone-voice/1.7b',
            {
                input: {
                    audio_url,
                    reference_text: reference_text || undefined
                },
                logs: true
            }
        ) as {
            speaker_embedding?: {
                url?: string;
                file_name?: string;
                file_size?: number;
            };
        };

        if (!result.speaker_embedding?.url) {
            throw new Error('No speaker embedding URL returned from Qwen API');
        }

        console.log('✅ Qwen voice cloned:', result.speaker_embedding.url);

        await deductCredits(user.id, cost, 'Qwen Voice Cloning', {
            audio_url,
            embedding_url: result.speaker_embedding.url
        });

        return NextResponse.json({
            embedding_url: result.speaker_embedding.url,
            file_name: result.speaker_embedding.file_name,
            file_size: result.speaker_embedding.file_size,
            cost
        });

    } catch (error: unknown) {
        console.error('Voice cloning error:', error);

        let errorMessage = 'Voice cloning failed';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
