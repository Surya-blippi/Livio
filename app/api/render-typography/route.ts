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

    console.log('[Typography API] ===== REQUEST RECEIVED =====');
    console.log('[Typography API] Region:', REMOTION_AWS_REGION);
    console.log('[Typography API] Function:', FUNCTION_NAME);
    console.log('[Typography API] ServeURL:', SERVE_URL);

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

        console.log('[Typography API] Body received:');
        console.log('[Typography API]   - audioUrl:', audioUrl ? 'present' : 'missing');
        console.log('[Typography API]   - audioBase64:', audioBase64 ? `${audioBase64.length} chars` : 'missing');
        console.log('[Typography API]   - wordTimings:', wordTimings?.length || 0, 'words');
        console.log('[Typography API]   - wordsPerGroup:', wordsPerGroup);
        console.log('[Typography API]   - animationStyle:', animationStyle);
        console.log('[Typography API]   - aspectRatio:', aspectRatio);

        if (!wordTimings || wordTimings.length === 0) {
            console.log('[Typography API] ERROR: No word timings');
            return NextResponse.json({ error: 'Word timings are required' }, { status: 400 });
        }

        if (!audioUrl && !audioBase64) {
            console.log('[Typography API] ERROR: No audio');
            return NextResponse.json({ error: 'Audio (audioUrl or audioBase64) is required' }, { status: 400 });
        }

        console.log('[Typography API] Creating temp directory...');
        await fs.mkdir(tempDir, { recursive: true });

        // Prepare audio URL
        let finalAudioUrl = audioUrl;
        if (audioBase64 && !audioUrl) {
            finalAudioUrl = `data:audio/mp3;base64,${audioBase64}`;
            console.log('[Typography API] Using base64 audio, length:', finalAudioUrl.length);
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
        console.log('[Typography API] Dimensions:', width, 'x', height);

        const fps = 30;

        // Convert word timings to frame-based format
        const typographyWords = convertToFrameTimings(wordTimings, fps);
        console.log('[Typography API] Converted', typographyWords.length, 'words to frame timings');
        console.log('[Typography API] First word:', JSON.stringify(typographyWords[0]));
        console.log('[Typography API] Last word:', JSON.stringify(typographyWords[typographyWords.length - 1]));

        // Calculate total duration from last word
        const lastWord = typographyWords[typographyWords.length - 1];
        const durationInFrames = lastWord.endFrame + Math.floor(fps * 0.5);
        console.log('[Typography API] Duration in frames:', durationInFrames, '(', durationInFrames / fps, 's)');

        // Render on Lambda
        console.log('[Typography API] ===== CALLING LAMBDA =====');
        console.log('[Typography API] Input props:', JSON.stringify({
            audioUrl: finalAudioUrl.substring(0, 100) + '...',
            words: typographyWords.slice(0, 2),
            wordsPerGroup,
            animationStyle,
        }, null, 2));

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

        console.log('[Typography API] ===== LAMBDA STARTED =====');
        console.log('[Typography API] Render ID:', renderResult.renderId);
        console.log('[Typography API] Bucket:', renderResult.bucketName);

        // Poll for completion
        let completed = false;
        let outputUrl = '';
        let pollCount = 0;

        while (!completed) {
            pollCount++;
            console.log('[Typography API] Polling progress (attempt', pollCount, ')...');

            const progress = await getRenderProgress({
                region: REMOTION_AWS_REGION as any,
                functionName: FUNCTION_NAME,
                bucketName: renderResult.bucketName,
                renderId: renderResult.renderId,
            });

            console.log('[Typography API] Progress response:', JSON.stringify({
                done: progress.done,
                overallProgress: progress.overallProgress,
                fatalErrorEncountered: progress.fatalErrorEncountered,
                errors: progress.errors,
                outputFile: progress.outputFile,
            }));

            if (progress.done) {
                completed = true;
                outputUrl = progress.outputFile || '';
                console.log('[Typography API] ===== RENDER COMPLETE =====');
                console.log('[Typography API] Output URL:', outputUrl);
            } else if (progress.fatalErrorEncountered) {
                console.log('[Typography API] ===== FATAL ERROR =====');
                console.log('[Typography API] Errors:', JSON.stringify(progress.errors, null, 2));
                throw new Error(`Lambda render failed: ${JSON.stringify(progress.errors)}`);
            } else {
                const pct = Math.round((progress.overallProgress || 0) * 100);
                console.log(`[Typography API] Progress: ${pct}%`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Safety: max 60 polls (2 minutes)
            if (pollCount > 60) {
                throw new Error('Render timeout - exceeded 2 minutes');
            }
        }

        // Clean up
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }

        console.log('[Typography API] ===== SUCCESS =====');
        return NextResponse.json({
            videoUrl: outputUrl,
            duration: durationInFrames / fps,
        });

    } catch (error) {
        console.error('[Typography API] ===== ERROR =====');
        console.error('[Typography API] Error type:', error?.constructor?.name);
        console.error('[Typography API] Error message:', error instanceof Error ? error.message : String(error));
        console.error('[Typography API] Full error:', error);

        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }

        return NextResponse.json(
            { error: `Failed to render typography video: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
