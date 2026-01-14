import { fal } from '@fal-ai/client';
import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits } from '@/lib/supabase';
import { calculateAudioCredits } from '@/lib/credits';

export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { script, customVoiceId, audioFileBase64 } = body;

        if (!script) {
            return NextResponse.json(
                { error: 'Script is required' },
                { status: 400 }
            );
        }

        if (customVoiceId === 'pending') {
            return NextResponse.json(
                { error: 'Voice is still cloning. Please wait or try again.' },
                { status: 400 }
            );
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

        // If we have a custom voice ID, use the Speech-02 HD API directly
        if (customVoiceId) {
            console.log('Generating speech with custom voice ID:', customVoiceId);

            try {
                const result = await fal.subscribe('fal-ai/minimax/speech-02-hd', {
                    input: {
                        text: script,
                        voice_setting: {
                            voice_id: customVoiceId,
                            speed: 1.2,
                            vol: 1,
                            pitch: 0
                        },
                        output_format: 'url'
                    },
                    logs: true,
                    onQueueUpdate: (update) => {
                        if (update.status === 'IN_PROGRESS') {
                            console.log('TTS progress:', update.logs?.map((log: { message: string }) => log.message));
                        }
                    }
                });

                console.log('TTS result:', result);

                if (!result.data.audio || !result.data.audio.url) {
                    throw new Error('No audio URL returned from TTS API');
                }

                // Return the ACTUAL duration from MiniMax for perfect caption sync
                const actualDurationMs = result.data.duration_ms || 0;
                console.log(`TTS actual duration: ${actualDurationMs}ms (${(actualDurationMs / 1000).toFixed(2)}s)`);

                // Deduct credits
                await deductCredits(user.id, cost, 'Generated Speech', {
                    charCount: script.length,
                    voiceId: customVoiceId
                });

                return NextResponse.json({
                    audioUrl: result.data.audio.url,
                    durationMs: actualDurationMs // CRITICAL: Use actual TTS duration for sync
                });
            } catch (ttsError: unknown) {
                console.error('Speech-02 HD error with custom voice ID:', ttsError);

                // Log full error details
                if (ttsError && typeof ttsError === 'object' && 'body' in ttsError) {
                    console.error('Fal TTS Error Body:', JSON.stringify((ttsError as { body?: unknown }).body, null, 2));
                }

                // Check if this is a voice not found / expired error
                const errorMessage = ttsError instanceof Error ? ttsError.message : String(ttsError);
                const errorBody = (ttsError as { body?: { detail?: string } })?.body?.detail || '';

                if (errorMessage.includes('voice') || errorMessage.includes('not found') || errorMessage.includes('invalid') ||
                    errorBody.includes('voice') || errorBody.includes('not found')) {
                    console.error('TTS Voice Error:', errorMessage);
                    return NextResponse.json(
                        {
                            error: 'Voice expired or not found',
                            code: 'VOICE_EXPIRED',
                            details: 'The saved voice ID has expired. Please re-clone your voice.'
                        },
                        { status: 410 }
                    );
                }

                throw ttsError;
            }
        }

        // Fallback: Use the voice-clone endpoint with audio file (re-clone and generate)
        if (!audioFileBase64) {
            return NextResponse.json(
                { error: 'Either customVoiceId or audioFileBase64 is required' },
                { status: 400 }
            );
        }

        console.log('Generating speech by re-cloning voice...');

        // Note: Re-cloning typically includes a small "setup" cost but here we treat it as part of speech gen?
        // Actually, this route is "generate-speech". Re-cloning voice every time is inefficient but valid if ID expired.
        // We will just charge speech cost here. If they want separate clone, they use clone-voice.
        // Or if this does BOTH clone + speech, maybe we should charge extra?
        // User spec says: "Audio generation (1000 chars) $0.10 30 credits".
        // It doesn't specify surcharge for inline cloning. Let's keep it simple at speech cost for now.

        const result = await fal.subscribe('fal-ai/minimax/voice-clone', {
            input: {
                audio_url: audioFileBase64,
                text: script,
                model: 'speech-02-hd',
                noise_reduction: true,
                need_volume_normalization: true
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS') {
                    console.log('TTS progress:', update.logs?.map((log: { message: string }) => log.message));
                }
            }
        });

        console.log('TTS result:', result);

        if (!result.data.audio || !result.data.audio.url) {
            throw new Error('No audio URL returned from TTS API');
        }
        // Extract duration from response (duration_ms is in the data object)
        const durationMs = (result.data as unknown as { duration_ms?: number }).duration_ms || 0;

        // Deduct credits
        await deductCredits(user.id, cost, 'Generated Speech (with clone)', {
            charCount: script.length,
            newVoiceId: result.data.custom_voice_id
        });

        return NextResponse.json({
            audioUrl: result.data.audio.url,
            duration: durationMs, // Duration in ms for scene-based face mode
            // Return the new voice ID if re-cloned so frontend can update
            newVoiceId: result.data.custom_voice_id,
            newPreviewUrl: result.data.audio.url
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
