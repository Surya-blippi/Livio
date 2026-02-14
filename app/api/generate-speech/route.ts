import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits, supabase, updateQwenEmbedding, createAuthenticatedClient } from '@/lib/supabase';
import { calculateAudioCredits } from '@/lib/credits';
import { cloneVoiceWithQwen, generateSpeechWithQwen } from '@/lib/fal';



const FAL_KEY = process.env.FAL_KEY;

// Allow longer timeout for JIT cloning (5 mins)
export const maxDuration = 300;



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

    // If there are multiple audio chunks, concatenate them into a single file
    if (result.audioUrls && result.audioUrls.length > 1) {
        console.log(`🔗 Concatenating ${result.audioUrls.length} audio chunks into single file...`);
        try {
            // Download all audio chunks
            const audioBuffers: Buffer[] = [];
            for (let i = 0; i < result.audioUrls.length; i++) {
                const response = await fetch(result.audioUrls[i]);
                const arrayBuffer = await response.arrayBuffer();
                audioBuffers.push(Buffer.from(arrayBuffer));
                console.log(`  ✅ Downloaded chunk ${i + 1}/${result.audioUrls.length} (${audioBuffers[i].length} bytes)`);
            }

            // Concatenate all buffers (MP3 concatenation works for same-codec files)
            const combinedBuffer = Buffer.concat(audioBuffers);
            console.log(`  📦 Combined audio: ${combinedBuffer.length} bytes`);

            // Upload to Supabase Storage
            const fileName = `tts-combined/${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
            const { createClient } = await import('@supabase/supabase-js');
            const adminClient = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            const { error: uploadError } = await adminClient.storage
                .from('videos')
                .upload(fileName, combinedBuffer, {
                    contentType: 'audio/mpeg',
                    upsert: true
                });

            if (uploadError) {
                console.warn('⚠️ Failed to upload combined audio, using first chunk:', uploadError);
                return { audioUrl: result.audioUrl, duration: result.duration };
            }

            const { data: urlData } = adminClient.storage.from('videos').getPublicUrl(fileName);
            console.log(`  ✅ Combined audio uploaded: ${urlData.publicUrl}`);

            return {
                audioUrl: urlData.publicUrl,
                duration: result.duration
            };
        } catch (concatError) {
            console.warn('⚠️ Audio concatenation failed, using first chunk:', concatError);
            return { audioUrl: result.audioUrl, duration: result.duration };
        }
    }

    return {
        audioUrl: result.audioUrl,
        duration: result.duration
    };
}

async function cloneVoiceWithQwenForUser(
    audioUrl: string,
    userId: string,
    voiceRecordId: string,
    client: any,
    referenceText?: string
): Promise<string> {
    console.log('🧬 Qwen JIT Cloning: Creating speaker embedding...');

    const embeddingResult = await cloneVoiceWithQwen(audioUrl, referenceText);

    await updateQwenEmbedding(voiceRecordId, embeddingResult.embeddingUrl, client);

    console.log('✅ Qwen embedding saved:', embeddingResult.embeddingUrl);

    return embeddingResult.embeddingUrl;
}

export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const { userId: clerkId, getToken } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Create authenticated Supabase client using Clerk token
        const token = await getToken({ template: 'supabase' });
        const authClient = token ? createAuthenticatedClient(token) : supabase;

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
                    authClient,
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
