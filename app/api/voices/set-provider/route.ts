import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase, updateVoiceProvider, DbVoice } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { voiceId, provider } = body;

        if (!voiceId || !provider) {
            return NextResponse.json(
                { error: 'voiceId and provider are required' },
                { status: 400 }
            );
        }

        if (provider !== 'minimax' && provider !== 'qwen') {
            return NextResponse.json(
                { error: 'Provider must be "minimax" or "qwen"' },
                { status: 400 }
            );
        }

        const { data: voice } = await supabase
            .from('voices')
            .select('*')
            .eq('id', voiceId)
            .eq('user_id', clerkId)
            .single();

        if (!voice) {
            return NextResponse.json(
                { error: 'Voice not found' },
                { status: 404 }
            );
        }

        if (provider === 'qwen' && !voice.qwen_embedding_url) {
            return NextResponse.json({
                error: 'Qwen embedding not available for this voice. Please clone the voice with Qwen first.',
                code: 'NO_EMBEDDING'
            }, { status: 400 });
        }

        if (provider === 'minimax' && !voice.minimax_voice_id) {
            return NextResponse.json({
                error: 'MiniMax voice ID not available for this voice. Please clone the voice with MiniMax first.',
                code: 'NO_VOICE_ID'
            }, { status: 400 });
        }

        const updatedVoice = await updateVoiceProvider(voiceId, provider);

        if (!updatedVoice) {
            return NextResponse.json(
                { error: 'Failed to update voice provider' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            voice: {
                id: updatedVoice.id,
                provider: updatedVoice.tts_provider
            }
        });

    } catch (error: unknown) {
        console.error('Set provider error:', error);

        let errorMessage = 'Failed to set voice provider';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
