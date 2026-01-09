import { fal } from '@fal-ai/client';
import { NextRequest, NextResponse } from 'next/server';

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

        // Call Whisper via fal.ai - use segment level (word level not supported)
        const result = await fal.subscribe('fal-ai/wizper', {
            input: {
                audio_url: audioUrl,
                task: 'transcribe',
                language: 'en',
                // chunk_level defaults to 'segment' - we'll parse words from segments
                version: '3'
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS') {
                    console.log('Whisper progress:', update.logs?.map((log: { message: string }) => log.message));
                }
            }
        });

        // Cast through unknown to handle fal.ai type differences
        const whisperData = result.data as unknown as WhisperResult;

        console.log('Whisper result chunks:', whisperData.chunks?.length || 0);

        if (!whisperData.chunks || whisperData.chunks.length === 0) {
            console.warn('⚠️ No chunks returned from Whisper, falling back to text split');
            return NextResponse.json({
                text: whisperData.text || '',
                wordTimings: []
            });
        }

        // Parse segments into word-level timings
        // Each segment has text and [start, end] timestamp - we distribute words proportionally
        const wordTimings: WordTiming[] = [];

        for (const chunk of whisperData.chunks) {
            const segmentStart = chunk.timestamp[0];
            const segmentEnd = chunk.timestamp[1];
            const segmentDuration = segmentEnd - segmentStart;

            // Split segment text into words
            const words = chunk.text.trim().split(/\s+/).filter(w => w.length > 0);
            if (words.length === 0) continue;

            // Distribute time proportionally across words in this segment
            const timePerWord = segmentDuration / words.length;
            let currentTime = segmentStart;

            for (const word of words) {
                wordTimings.push({
                    word: word,
                    start: currentTime,
                    end: currentTime + timePerWord
                });
                currentTime += timePerWord;
            }
        }

        console.log(`✅ Got ${wordTimings.length} word timings from ${whisperData.chunks.length} Whisper segments`);

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
