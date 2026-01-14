import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { supabase, getOrCreateUser, getUserCredits, deductCredits } from '@/lib/supabase';
import { auth, currentUser } from '@clerk/nextjs/server';
import { CREDIT_COSTS } from '@/lib/credits';

const execAsync = promisify(exec);

// Helper to run exec with timeout
async function execWithTimeout(command: string, timeoutMs: number = 120000, label: string = 'Command'): Promise<{ stdout: string; stderr: string }> {
    console.log(`  [${label}] Starting...`);
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const childProcess = exec(command, { maxBuffer: 100 * 1024 * 1024 }, (error, stdout, stderr) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            if (error) {
                console.error(`  [${label}] Failed after ${duration}s:`, error.message);
                reject(error);
            } else {
                console.log(`  [${label}] Completed in ${duration}s`);
                resolve({ stdout, stderr });
            }
        });

        // Set timeout
        const timeout = setTimeout(() => {
            childProcess.kill('SIGKILL');
            console.error(`  [${label}] TIMEOUT after ${timeoutMs / 1000}s - killing process`);
            reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`));
        }, timeoutMs);

        // Clear timeout if process completes
        childProcess.on('exit', () => clearTimeout(timeout));
    });
}

const WAVESPEED_API_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk';
const WAVESPEED_API_KEY = process.env.NEXT_PUBLIC_WAVESPEED_API_KEY!;

interface WordTiming {
    word: string;
    start: number;
    end: number;
}

interface Segment {
    index: number;
    type: 'face' | 'asset';
    startTime: number;
    endTime: number;
    duration: number;
}

// Generate ASS subtitle content
function generateASSContent(wordTimings: WordTiming[], width: number = 1080, height: number = 1920): string {
    const header = `[Script Info]
Title: Face Mode Captions
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Impact,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,2,0,1,4,2,2,60,60,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const events: string[] = [];
    const wordsPerPhrase = 4;

    for (let i = 0; i < wordTimings.length; i += wordsPerPhrase) {
        const phraseWords = wordTimings.slice(i, i + wordsPerPhrase);
        if (phraseWords.length === 0) continue;

        const phraseStart = phraseWords[0].start;
        const phraseEnd = phraseWords[phraseWords.length - 1].end;
        const text = phraseWords.map(w => w.word).join(' ');

        const startFormatted = formatASSTime(phraseStart);
        const endFormatted = formatASSTime(phraseEnd);

        events.push(`Dialogue: 0,${startFormatted},${endFormatted},Default,,0,0,0,,${text}`);
    }

    return header + events.join('\n');
}

function formatASSTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
}

// Generate segments timeline
function generateSegments(totalDuration: number, segmentDuration: number = 4): Segment[] {
    const segments: Segment[] = [];
    let currentTime = 0;
    let index = 0;

    while (currentTime < totalDuration) {
        const endTime = Math.min(currentTime + segmentDuration, totalDuration);
        segments.push({
            index,
            type: index % 2 === 0 ? 'face' : 'asset',
            startTime: currentTime,
            endTime,
            duration: endTime - currentTime
        });
        currentTime = endTime;
        index++;
    }

    return segments;
}

// Extract audio segment from full audio with a small buffer to prevent cutting off
async function extractAudioSegment(
    fullAudioPath: string,
    outputPath: string,
    startTime: number,
    duration: number,
    totalDuration: number
): Promise<void> {
    // Add 0.5s buffer at end to allow sentence to complete naturally
    // But don't exceed total audio length
    const buffer = 0.5;
    const adjustedDuration = Math.min(duration + buffer, totalDuration - startTime);

    await execWithTimeout(
        `ffmpeg -y -ss ${startTime} -i "${fullAudioPath}" -t ${adjustedDuration} -acodec copy "${outputPath}"`,
        30000, // 30 seconds timeout
        'Extract Audio'
    );
}

// Generate short WaveSpeed clip with timeout
async function generateWaveSpeedClip(
    imageDataUrl: string,
    audioPath: string,
    outputPath: string
): Promise<void> {
    // Read audio as base64 URL
    const audioBuffer = await fs.readFile(audioPath);
    const audioBase64 = audioBuffer.toString('base64');
    const audioDataUrl = `data:audio/mp3;base64,${audioBase64}`;

    console.log('  Calling WaveSpeed for face segment...');

    // Create video using WaveSpeed API
    const response = await axios.post(
        WAVESPEED_API_URL,
        {
            image: imageDataUrl,
            audio: audioDataUrl,
            resolution: '720p',
            seed: -1
        },
        {
            headers: {
                'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000 // 2 minute timeout for initial request (WaveSpeed can be slow)
        }
    );

    const responseData = response.data.data || response.data;
    const predictionId = responseData.id;

    // Poll for completion with timeout
    let videoUrl: string | null = null;
    const maxAttempts = 30; // 2.5 minutes max (30 * 5s)
    const startTime = Date.now();
    const maxWaitTime = 150000; // 2.5 minutes in ms

    for (let i = 0; i < maxAttempts; i++) {
        // Check if we've exceeded total time
        if (Date.now() - startTime > maxWaitTime) {
            console.warn('  ⚠️ WaveSpeed timeout exceeded');
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            const pollUrl = `https://api.wavespeed.ai/api/v3/predictions/${predictionId}/result`;
            const pollResponse = await axios.get(pollUrl, {
                headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
                timeout: 10000
            });

            const pollData = pollResponse.data.data || pollResponse.data;

            if (pollData.outputs && pollData.outputs.length > 0) {
                videoUrl = pollData.outputs[0];
                break;
            }
        } catch (pollErr) {
            console.warn(`  Poll attempt ${i + 1} failed, retrying...`);
        }
    }

    if (!videoUrl) {
        throw new Error('WaveSpeed timeout - no video generated');
    }

    // Download the video
    const videoResponse = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 60000 // 1 minute timeout for download
    });
    await fs.writeFile(outputPath, Buffer.from(videoResponse.data));

    console.log('  ✅ WaveSpeed segment complete');
}

// Create Ken Burns asset video segment with PROPER aspect ratio (black background)
async function createAssetSegment(
    assetPath: string,
    duration: number,
    outputPath: string
): Promise<void> {
    const frameCount = Math.floor(duration * 30);

    // FFmpeg filter chain:
    // 1. Scale image to fit within 1080x1920 while preserving aspect ratio
    // 2. Add black padding to fill 1080x1920
    // 3. Apply subtle Ken Burns zoom effect
    const vf = [
        // First scale to fit within target while preserving aspect ratio
        "scale=1080:1920:force_original_aspect_ratio=decrease",
        // Then pad to exact 1080x1920 with black background, centered
        "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
        // Apply subtle Ken Burns zoom (slow zoom from 1.0 to 1.1)
        `zoompan=z='1+0.1*on/${frameCount}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frameCount}:s=1080x1920:fps=30`
    ].join(',');

    await execWithTimeout(
        `ffmpeg -y -loop 1 -i "${assetPath}" -vf "${vf}" -t ${duration} -c:v libx264 -preset fast -pix_fmt yuv420p "${outputPath}"`,
        60000, // 1 minute timeout per asset
        'Asset Ken Burns'
    );
}

export async function POST(request: NextRequest) {
    const tempDir = path.join(os.tmpdir(), `optimized-face-${Date.now()}`);

    try {
        // === AUTHENTICATION ===
        const { userId: clerkUserId } = await auth();
        if (!clerkUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 401 });
        }

        // Get or create user in Supabase
        const dbUser = await getOrCreateUser(
            clerkUserId,
            user.emailAddresses[0]?.emailAddress || '',
            user.firstName || user.username || 'User'
        );

        if (!dbUser) {
            return NextResponse.json({ error: 'Failed to verify user' }, { status: 500 });
        }

        const {
            imageUrl,
            audioUrl,
            assets,
            wordTimings,
            enableBackgroundMusic,
            segmentDuration = 4
        } = await request.json() as {
            imageUrl: string;
            audioUrl: string;
            assets?: string[];
            wordTimings?: WordTiming[];
            enableBackgroundMusic?: boolean;
            segmentDuration?: number;
        };

        if (!imageUrl || !audioUrl) {
            return NextResponse.json(
                { error: 'Missing imageUrl or audioUrl' },
                { status: 400 }
            );
        }

        console.log('🎬 Optimized face mode video generation:');
        console.log(`  - Segment duration: ${segmentDuration}s`);
        console.log(`  - Assets: ${assets?.length || 0}`);
        console.log(`  - Word timings: ${wordTimings?.length || 0}`);

        await fs.mkdir(tempDir, { recursive: true });

        // Prepare the face image
        let imageDataUrl: string;
        if (imageUrl.startsWith('data:')) {
            imageDataUrl = imageUrl;
        } else {
            const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imgBase64 = Buffer.from(imgResponse.data).toString('base64');
            const mimeType = imgResponse.headers['content-type'] || 'image/jpeg';
            imageDataUrl = `data:${mimeType};base64,${imgBase64}`;
        }

        // Download full audio
        const fullAudioPath = path.join(tempDir, 'full_audio.mp3');
        if (audioUrl.startsWith('data:')) {
            const base64Data = audioUrl.split(',')[1];
            await fs.writeFile(fullAudioPath, Buffer.from(base64Data, 'base64'));
        } else {
            const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
            await fs.writeFile(fullAudioPath, Buffer.from(audioResponse.data));
        }

        // Get audio duration
        const { stdout: durationStr } = await execAsync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullAudioPath}"`
        );
        const totalDuration = parseFloat(durationStr.trim());
        console.log(`  - Total audio duration: ${totalDuration.toFixed(2)}s`);

        // Download assets
        const assetPaths: string[] = [];
        if (assets && assets.length > 0) {
            for (let i = 0; i < assets.length; i++) {
                try {
                    const assetPath = path.join(tempDir, `asset_${i}.jpg`);
                    if (assets[i].startsWith('data:')) {
                        const b64 = assets[i].split(',')[1];
                        await fs.writeFile(assetPath, Buffer.from(b64, 'base64'));
                    } else {
                        const resp = await axios.get(assets[i], { responseType: 'arraybuffer' });
                        await fs.writeFile(assetPath, Buffer.from(resp.data));
                    }
                    assetPaths.push(assetPath);
                } catch (err) {
                    console.warn(`  ⚠️ Failed to download asset ${i}`);
                }
            }
        }
        console.log(`  - Downloaded ${assetPaths.length} assets`);

        // Generate segment timeline
        const segments = generateSegments(totalDuration, segmentDuration);
        const faceSegmentCount = segments.filter(s => s.type === 'face').length;
        console.log(`  - Generated ${segments.length} segments (${faceSegmentCount} face, ${segments.filter(s => s.type === 'asset').length} asset)`);

        // === CREDIT CALCULATION & DEDUCTION ===
        const faceCredits = faceSegmentCount * CREDIT_COSTS.FACE_VIDEO_SCENE;
        const renderCredits = CREDIT_COSTS.VIDEO_RENDER;
        const totalCost = faceCredits + renderCredits;

        console.log(`  - Credit Calculation: ${faceSegmentCount} scenes * 100 + 80 render = ${totalCost} credits`);

        // Check credits
        const userCredits = await getUserCredits(dbUser.id);
        if (!userCredits || userCredits.balance < totalCost) {
            // Cleanup temp dir before returning error
            await fs.rm(tempDir, { recursive: true, force: true });

            return NextResponse.json(
                {
                    error: `Insufficient credits. Need ${totalCost}, have ${userCredits?.balance || 0}`,
                    creditsNeeded: totalCost,
                    currentBalance: userCredits?.balance || 0
                },
                { status: 402 }
            );
        }

        // Deduct credits
        const deductResult = await deductCredits(
            dbUser.id,
            totalCost,
            'Optimized Face Video Generation',
            {
                duration: totalDuration,
                faceSegments: faceSegmentCount,
                totalSegments: segments.length
            }
        );

        if (!deductResult.success) {
            await fs.rm(tempDir, { recursive: true, force: true });
            return NextResponse.json({ error: 'Failed to process credit deduction' }, { status: 500 });
        }

        console.log(`  💳 Credits deducted: ${totalCost}`);

        // Process each segment
        const segmentVideoPaths: string[] = [];
        let assetIndex = 0;

        for (const segment of segments) {
            const segmentPath = path.join(tempDir, `segment_${segment.index}.mp4`);

            if (segment.type === 'face') {
                // Generate WaveSpeed clip for face segment
                console.log(`  Segment ${segment.index}: Face [${segment.startTime.toFixed(1)}s - ${segment.endTime.toFixed(1)}s]`);

                // Extract audio segment with buffer to prevent cutting off words
                const segAudioPath = path.join(tempDir, `audio_seg_${segment.index}.mp3`);
                await extractAudioSegment(fullAudioPath, segAudioPath, segment.startTime, segment.duration, totalDuration);

                // Generate WaveSpeed clip
                await generateWaveSpeedClip(imageDataUrl, segAudioPath, segmentPath);

            } else {
                // Create Ken Burns asset segment
                console.log(`  Segment ${segment.index}: Asset ${assetIndex} [${segment.startTime.toFixed(1)}s - ${segment.endTime.toFixed(1)}s]`);

                if (assetPaths.length > 0) {
                    const assetPath = assetPaths[assetIndex % assetPaths.length];
                    await createAssetSegment(assetPath, segment.duration, segmentPath);
                    assetIndex++;
                } else {
                    // No assets, use face image with Ken Burns
                    const tempImgPath = path.join(tempDir, 'face_fallback.jpg');
                    const imgBase64 = imageDataUrl.split(',')[1];
                    await fs.writeFile(tempImgPath, Buffer.from(imgBase64, 'base64'));
                    await createAssetSegment(tempImgPath, segment.duration, segmentPath);
                }
            }

            segmentVideoPaths.push(segmentPath);
        }

        // Concatenate all video segments
        console.log('  Concatenating segments...');
        const concatListPath = path.join(tempDir, 'concat.txt');
        const concatContent = segmentVideoPaths.map(p => `file '${p}'`).join('\n');
        await fs.writeFile(concatListPath, concatContent);

        const concatenatedPath = path.join(tempDir, 'concatenated.mp4');
        await execWithTimeout(
            `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -preset fast "${concatenatedPath}"`,
            180000, // 3 minutes for concatenation
            'Concat'
        );

        // Replace audio with full continuous audio
        const withAudioPath = path.join(tempDir, 'with_audio.mp4');
        await execWithTimeout(
            `ffmpeg -y -i "${concatenatedPath}" -i "${fullAudioPath}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${withAudioPath}"`,
            60000, // 1 minute for audio merge
            'Audio Merge'
        );

        let outputPath = withAudioPath;

        // Add background music if enabled
        if (enableBackgroundMusic) {
            const bgMusicPath = path.join(process.cwd(), 'public', 'Feeling Blue.mp3');
            try {
                await fs.access(bgMusicPath);
                const withMusicPath = path.join(tempDir, 'with_music.mp4');
                await execWithTimeout(
                    `ffmpeg -y -i "${outputPath}" -stream_loop -1 -i "${bgMusicPath}" -filter_complex "[0:a]volume=1.0[voice];[1:a]volume=0.15[music];[voice][music]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -shortest "${withMusicPath}"`,
                    120000, // 2 minutes for music mixing
                    'Background Music'
                );
                outputPath = withMusicPath;
            } catch (musicErr) {
                console.warn('  ⚠️ Background music failed:', musicErr instanceof Error ? musicErr.message : 'Unknown');
            }
        }

        // Add captions
        if (wordTimings && wordTimings.length > 0) {
            const assContent = generateASSContent(wordTimings);
            const assPath = path.join(tempDir, 'captions.ass');
            await fs.writeFile(assPath, assContent);

            const finalPath = path.join(tempDir, 'output.mp4');
            await execWithTimeout(
                `ffmpeg -y -i "${outputPath}" -vf "ass='${assPath}'" -c:v libx264 -preset fast -crf 23 -c:a copy "${finalPath}"`,
                180000, // 3 minutes for caption rendering
                'Captions'
            );
            outputPath = finalPath;
        }

        // Read final video
        const videoBuffer = await fs.readFile(outputPath);
        const videoBase64 = videoBuffer.toString('base64');

        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });

        console.log('🎬 Optimized face video complete!');

        return NextResponse.json({
            videoUrl: `data:video/mp4;base64,${videoBase64}`
        });

    } catch (error) {
        console.error('Error in optimized face video:', error);

        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }

        return NextResponse.json(
            { error: `Failed to generate optimized face video: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
