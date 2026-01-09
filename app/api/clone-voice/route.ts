import { fal } from '@fal-ai/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            return NextResponse.json(
                { error: 'Audio file is required' },
                { status: 400 }
            );
        }

        // Convert file to buffer and then to base64 URL
        const arrayBuffer = await audioFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        // Use wav as default if webm, as fal.ai may not support webm well
        let mimeType = audioFile.type || 'audio/wav';

        console.log('Cloning voice with audio file:', audioFile.name, audioFile.type, 'size:', buffer.length, 'bytes');

        const audioUrl = `data:${mimeType};base64,${base64}`;

        // Call MiniMax voice cloning API (just clone, don't generate speech yet)
        const result = await fal.subscribe('fal-ai/minimax/voice-clone', {
            input: {
                audio_url: audioUrl,
                model: 'speech-02-hd',
                noise_reduction: true,
                need_volume_normalization: true
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS') {
                    console.log('Voice cloning progress:', update.logs?.map((log: { message: string }) => log.message));
                }
            }
        });

        console.log('Voice cloning result:', result);

        return NextResponse.json({
            voiceId: result.data.custom_voice_id,
            previewUrl: result.data.audio?.url,
            audioBase64: base64
        });

    } catch (error: unknown) {
        console.error('Error cloning voice:', error);

        let errorMessage = 'Failed to clone voice';
        let errorDetails = null;

        if (error instanceof Error) {
            errorMessage = error.message;
            // Try to extract more details from fal.ai error
            if ('body' in error) {
                errorDetails = (error as { body?: unknown }).body;
                console.error('Fal.ai error body:', JSON.stringify(errorDetails, null, 2));
            }
            if ('status' in error) {
                console.error('Fal.ai error status:', (error as { status?: number }).status);
            }
        }

        return NextResponse.json(
            {
                error: errorMessage,
                details: errorDetails,
                hint: 'Voice cloning requires a clear audio sample of at least 10 seconds. Make sure to speak clearly without background noise.'
            },
            { status: 500 }
        );
    }
}
