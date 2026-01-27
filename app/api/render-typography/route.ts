import { NextRequest, NextResponse } from 'next/server';
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface WordTiming {
    word: string;
    start: number;
    end: number;
}

interface TypographyWord {
    text: string;
    startFrame: number;
    endFrame: number;
}

// Convert word timings (seconds) to frame-based timing for Remotion
function convertToFrameTimings(wordTimings: WordTiming[], fps: number = 30): TypographyWord[] {
    return wordTimings.map(wt => ({
        text: wt.word,
        startFrame: Math.floor(wt.start * fps),
        endFrame: Math.floor(wt.end * fps),
    }));
}

// Lambda configuration
const REMOTION_AWS_REGION = process.env.REMOTION_AWS_REGION || 'eu-north-1';
const FUNCTION_NAME = 'remotion-render-4-0-407-mem2048mb-disk2048mb-240sec';
const SERVE_URL = 'https://remotionlambda-eunorth1-uzdpd4m8du.s3.eu-north-1.amazonaws.com/sites/typography-site-v2/index.html';

export async function POST(request: NextRequest) {
    const tempDir = path.join(os.tmpdir(), `typography-${Date.now()}`);

    try {
        const body = await request.json();
        const {
            audioUrl,
            audioBase64,
            wordTimings,
            wordsPerGroup = 3,
            animationStyle = 'pop',
            aspectRatio = '9:16'
        } = body;

        if (!wordTimings || wordTimings.length === 0) {
            return NextResponse.json({ error: 'Word timings are required' }, { status: 400 });
        }

        if (!audioUrl && !audioBase64) {
            return NextResponse.json({ error: 'Audio (audioUrl or audioBase64) is required' }, { status: 400 });
        }

        console.log('[Typography Lambda] Starting video generation');

        // Create temp directory
        await fs.mkdir(tempDir, { recursive: true });

        // Prepare audio URL
        let finalAudioUrl = audioUrl;
        if (audioBase64 && !audioUrl) {
            // For base64 audio, we need to upload to a public URL
            // For now, use a data URL (works for small files)
            finalAudioUrl = `data:audio/mp3;base64,${audioBase64}`;
        }

        // Determine dimensions
        let width = 1080;
        let height = 1920;
        if (aspectRatio === '16:9') {
            width = 1920;
            height = 1080;
        } else if (aspectRatio === '1:1') {
            width = 1080;
            height = 1080;
        }

        const fps = 30;

        // Convert word timings to frame-based format
        const typographyWords = convertToFrameTimings(wordTimings, fps);
        console.log(`[Typography Lambda] Converted ${typographyWords.length} words to frame timings`);

        // Calculate total duration from last word
        const lastWord = typographyWords[typographyWords.length - 1];
        const durationInFrames = lastWord.endFrame + Math.floor(fps * 0.5); // Add 0.5s padding

        // Render on Lambda
        console.log('[Typography Lambda] Starting Lambda render...');

        const renderResult = await renderMediaOnLambda({
            region: REMOTION_AWS_REGION as any,
            functionName: FUNCTION_NAME,
            serveUrl: SERVE_URL,
            composition: 'TypographyComposition',
            inputProps: {
                audioUrl: finalAudioUrl,
                words: typographyWords,
                wordsPerGroup,
                animationStyle,
            },
            codec: 'h264',
            framesPerLambda: 20,
            privacy: 'public',
            downloadBehavior: {
                type: 'download',
                fileName: 'typography-video.mp4',
            },
        });

        console.log('[Typography Lambda] Render started, polling for progress...');
        console.log('[Typography Lambda] Render ID:', renderResult.renderId);

        // Poll for completion
        let completed = false;
        let outputUrl = '';

        while (!completed) {
            const progress = await getRenderProgress({
                region: REMOTION_AWS_REGION as any,
                functionName: FUNCTION_NAME,
                bucketName: renderResult.bucketName,
                renderId: renderResult.renderId,
            });

            if (progress.done) {
                completed = true;
                outputUrl = progress.outputFile || '';
                console.log('[Typography Lambda] Render complete:', outputUrl);
            } else if (progress.fatalErrorEncountered) {
                throw new Error(`Lambda render failed: ${JSON.stringify(progress.errors)}`);
            } else {
                console.log(`[Typography Lambda] Progress: ${Math.round((progress.overallProgress || 0) * 100)}%`);
                // Wait before polling again
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Clean up temp directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }

        return NextResponse.json({
            videoUrl: outputUrl,
            duration: durationInFrames / fps,
        });

    } catch (error) {
        console.error('[Typography Lambda] Error:', error);

        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }

        return NextResponse.json(
            { error: `Failed to render typography video: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
