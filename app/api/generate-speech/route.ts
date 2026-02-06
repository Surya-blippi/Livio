import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits, supabase, updateQwenEmbedding } from '@/lib/supabase';
import { calculateAudioCredits } from '@/lib/credits';
import { cloneVoiceWithQwen, generateSpeechWithQwen } from '@/lib/fal';



const FAL_KEY = process.env.FAL_KEY;

// Allow longer timeout for JIT cloning
export const maxDuration = 60;



async function generateQwenTTS(
    text: string,
    embeddingUrl: string,
    referenceText?: string
): Promise<{ audioUrl: string; duration: number }> {
    console.log(`🎤 Qwen TTS: Generating with embedding`);

    const result = await generateSpeechWithQwen(text, {
        embeddingUrl,
        referenceText
    });

    return {
        audioUrl: result.audioUrl,
        duration: result.duration
    };
}

async function cloneVoiceWithQwenForUser(
    audioUrl: string,
    userId: string,
    voiceRecordId: string,
    referenceText?: string
): Promise<string> {
    console.log('🧬 Qwen JIT Cloning: Creating speaker embedding...');

    const embeddingResult = await cloneVoiceWithQwen(audioUrl, referenceText);

    await updateQwenEmbedding(voiceRecordId, embeddingResult.embeddingUrl);

    console.log('✅ Qwen embedding saved:', embeddingResult.embeddingUrl);

    return embeddingResult.embeddingUrl;
}

export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        if (!FAL_KEY) {
            console.error('FAL_KEY is missing');
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

        const { data: voiceData } = await supabase
            .from('voices')
            .select('id, qwen_embedding_url, voice_sample_url, ref_text')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single();

        const ttsProvider = 'qwen';
        let audioUrl: string;
        let duration: number;

        // Force Qwen logic
        if (!voiceData?.qwen_embedding_url && voiceData?.voice_sample_url) {
            console.log('⚠️ No Qwen embedding found, but voice sample exists. Triggering JIT cloning...');
            try {
                const embeddingUrl = await cloneVoiceWithQwenForUser(
                    voiceData.voice_sample_url,
                    user.id,
                    voiceData.id,
                    voiceData.ref_text || undefined
                );
                voiceData.qwen_embedding_url = embeddingUrl;
            } catch (cloneError) {
                console.error('❌ Qwen JIT Cloning failed:', cloneError);
            }
        }

        if (!voiceData?.qwen_embedding_url) {
            return NextResponse.json({
                error: 'No cloned voice found. Please upload a voice sample first.',
                code: 'NO_VOICE'
            }, { status: 400 });
        }

        console.log('🎙️ Using Qwen 3 TTS for speech generation');
        const qwenResult = await generateQwenTTS(
            script,
            voiceData.qwen_embedding_url,
            voiceData.ref_text || undefined
        );
        audioUrl = qwenResult.audioUrl;
        duration = qwenResult.duration;

        await deductCredits(user.id, cost, 'Generated Speech (Qwen)', {
            charCount: script.length,
            embedding_url: voiceData.qwen_embedding_url
        });

        console.log(`✅ Speech generated: ${audioUrl}`);

        return NextResponse.json({
            audioUrl,
            duration,
            cost,
            provider: ttsProvider
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
