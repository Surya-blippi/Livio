import { fal } from '@fal-ai/client';
import { NextRequest, NextResponse } from 'next/server';

// Allow 5 minutes for Whisper transcription
export const maxDuration = 300;

interface WhisperChunk {
    text: string;
    timestamp: [number, number]; // [start, end] in seconds
}

interface WhisperResult {
    text: string;
    chunks: WhisperChunk[];
}

interface WordTiming {
    word: string;
    start: number;
    end: number;
}

export async function POST(request: NextRequest) {
    try {
        const { audioUrl } = await request.json();

        if (!audioUrl) {
            return NextResponse.json(
                { error: 'Audio URL is required' },
                { status: 400 }
            );
        }

        console.log('🎙️ Transcribing audio with Whisper for exact word timings...');

        // Call Whisper via fal.ai with WORD-LEVEL timestamps for perfect sync
        const result = await fal.subscribe('fal-ai/whisper', {
            input: {
                audio_url: audioUrl,
                task: 'transcribe',
                language: 'en',
                chunk_level: 'word',  // TRUE word-level timestamps for perfect sync
                version: '3'
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS') {
                    console.log('Whisper progress:', update.logs?.map((log: { message: string }) => log.message));
                }
            }
        });

        // Helper to safely get the response data, checking for nested 'data' property
        // Fal sometimes returns { data: { text, chunks } } and sometimes just { text, chunks }
        const rawData = result.data as any;
        console.log('📦 Whisper Raw Response Keys:', Object.keys(rawData));

        const whisperData: WhisperResult = rawData.data || rawData;

        console.log('Whisper result chunks:', whisperData.chunks?.length || 0);

        if (!whisperData.chunks || whisperData.chunks.length === 0) {
            console.warn('⚠️ No chunks returned from Whisper, falling back to text split');
            return NextResponse.json({
                text: whisperData.text || '',
                wordTimings: []
            });
        }

        // With chunk_level: 'word', each chunk IS a single word with precise timestamps
        // No need to split/distribute - just map directly
        const wordTimings: WordTiming[] = [];

        for (const chunk of whisperData.chunks) {
            const wordText = chunk.text.trim();
            if (wordText.length === 0) continue;

            wordTimings.push({
                word: wordText,
                start: chunk.timestamp[0],
                end: chunk.timestamp[1]
            });
        }

        console.log(`✅ Got ${wordTimings.length} EXACT word timings from Whisper word-level chunks`);

        return NextResponse.json({
            text: whisperData.text,
            wordTimings
        });

    } catch (error: unknown) {
        console.error('Error transcribing audio:', error);

        const errorMessage = error instanceof Error ? error.message : 'Failed to transcribe audio';

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
