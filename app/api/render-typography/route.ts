import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits } from '@/lib/supabase';

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

export async function POST(request: NextRequest) {
    const tempDir = path.join(os.tmpdir(), `typography-${Date.now()}`);

    try {
        // Authenticate
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

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

        // Check credits
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

        // Typography video cost (similar to faceless video)
        const cost = 20; // 20 credits for typography video
        const hasCredits = await hasEnoughCredits(user.id, cost);

        if (!hasCredits) {
            return NextResponse.json({
                error: `Insufficient credits. Typography video requires ${cost} credits.`,
                code: 'INSUFFICIENT_CREDITS'
            }, { status: 402 });
        }

        console.log('[Typography] Starting video generation');

        // Create temp directory
        await fs.mkdir(tempDir, { recursive: true });

        // Prepare audio
        let finalAudioUrl = audioUrl;
        if (audioBase64 && !audioUrl) {
            // Save base64 audio to temp file
            const audioBuffer = Buffer.from(audioBase64, 'base64');
            const audioPath = path.join(tempDir, 'audio.mp3');
            await fs.writeFile(audioPath, audioBuffer);
            finalAudioUrl = `file://${audioPath}`;
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
        console.log(`[Typography] Converted ${typographyWords.length} words to frame timings`);

        // Calculate total duration from last word
        const lastWord = typographyWords[typographyWords.length - 1];
        const durationInFrames = lastWord.endFrame + Math.floor(fps * 0.5); // Add 0.5s padding

        // Bundle the Remotion project
        console.log('[Typography] Bundling Remotion project...');
        const bundleLocation = await bundle({
            entryPoint: path.join(process.cwd(), 'remotion', 'index.ts'),
            webpackOverride: (config) => config,
        });

        // Select the composition
        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: 'TypographyComposition',
            inputProps: {
                audioUrl: finalAudioUrl,
                words: typographyWords,
                wordsPerGroup,
                animationStyle,
            },
        });

        // Override duration based on audio
        const compositionWithDuration = {
            ...composition,
            durationInFrames,
            width,
            height,
        };

        // Render the video
        const outputPath = path.join(tempDir, 'output.mp4');
        console.log('[Typography] Rendering video...');

        await renderMedia({
            composition: compositionWithDuration,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation: outputPath,
            inputProps: {
                audioUrl: finalAudioUrl,
                words: typographyWords,
                wordsPerGroup,
                animationStyle,
            },
        });

        console.log('[Typography] Video rendered successfully');

        // Read the output video
        const videoBuffer = await fs.readFile(outputPath);
        const videoBase64 = videoBuffer.toString('base64');

        // Clean up
        await fs.rm(tempDir, { recursive: true, force: true });

        // Deduct credits
        await deductCredits(user.id, cost, 'Typography Video', {
            wordCount: wordTimings.length,
            durationSeconds: durationInFrames / fps,
            animationStyle,
        });

        const videoUrl = `data:video/mp4;base64,${videoBase64}`;

        return NextResponse.json({
            videoUrl,
            duration: durationInFrames / fps,
        });

    } catch (error) {
        console.error('[Typography] Error rendering video:', error);

        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }

        return NextResponse.json(
            { error: `Failed to render typography video: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
