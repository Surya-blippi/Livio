import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits, supabase, saveVoice } from '@/lib/supabase';
import { calculateAudioCredits } from '@/lib/credits';
import { cloneVoiceWithQwen } from '@/lib/fal';

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
        const { audio_url, name, reference_text } = body;

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

        const embeddingResult = await cloneVoiceWithQwen(audio_url, reference_text);

        const voice = await saveVoice(
            user.id,
            null,
            audio_url,
            name || 'My Voice',
            undefined,
            reference_text,
            {
                qwenEmbeddingUrl: embeddingResult.embeddingUrl,
                ttsProvider: 'qwen'
            }
        );

        if (!voice) {
            throw new Error('Failed to save voice to database');
        }

        console.log('✅ Qwen voice cloned and saved:', voice.id);

        await deductCredits(user.id, cost, 'Qwen Voice Cloning', {
            audio_url,
            embedding_url: embeddingResult.embeddingUrl,
            voice_id: voice.id
        });

        return NextResponse.json({
            success: true,
            voice: {
                id: voice.id,
                name: voice.name,
                embeddingUrl: embeddingResult.embeddingUrl,
                previewUrl: voice.preview_url,
                provider: 'qwen'
            },
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
