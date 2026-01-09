import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { fal } from '@fal-ai/client';

const execAsync = promisify(exec);

fal.config({
    credentials: process.env.FAL_KEY
});

const WAVESPEED_API_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk';
const WAVESPEED_API_KEY = process.env.NEXT_PUBLIC_WAVESPEED_API_KEY!;

interface SceneInput {
    text: string;
    type: 'face' | 'asset';
    assetUrl?: string;
}

interface WordTiming {
    word: string;
    start: number;
    end: number;
}

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

        const timeout = setTimeout(() => {
            childProcess.kill('SIGKILL');
            console.error(`  [${label}] TIMEOUT after ${timeoutMs / 1000}s`);
            reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`));
        }, timeoutMs);

        childProcess.on('exit', () => clearTimeout(timeout));
    });
}

// Generate TTS for a single scene using fal.ai directly
async function generateSceneTTS(text: string, voiceId: string): Promise<{ audioUrl: string; duration: number }> {
    console.log(`  [TTS] Generating for: "${text.substring(0, 50)}..."`);

    // Call fal.ai directly using the same pattern as generate-speech route
    const result = await fal.subscribe('fal-ai/minimax/speech-02-hd', {
        input: {
            text,
            voice_setting: {
                voice_id: voiceId,
                speed: 1,
                vol: 1,
                pitch: 0
            },
            output_format: 'url'
        },
        logs: false
    }) as unknown as { data: { audio: { url: string }; duration_ms?: number } };

    if (!result.data?.audio?.url) {
        throw new Error('No audio URL returned from TTS API');
    }

    const durationMs = result.data.duration_ms || 5000; // Fallback to 5s if no duration
    const duration = durationMs / 1000;

    console.log(`  [TTS] Generated ${duration.toFixed(2)}s audio`);

    return {
        audioUrl: result.data.audio.url,
        duration
    };
}

// Generate WaveSpeed face video for a scene
async function generateFaceVideo(
    imageDataUrl: string,
    audioUrl: string,
    outputPath: string
): Promise<void> {
    console.log(`  [WaveSpeed] Generating face video...`);

    // Download audio and convert to base64
    const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    const audioBase64 = Buffer.from(audioResponse.data).toString('base64');
    const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

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
            timeout: 180000 // 3 minutes for initial request
        }
    );

    const responseData = response.data.data || response.data;
    const predictionId = responseData.id;

    // Poll for completion
    let videoUrl: string | null = null;
    const maxAttempts = 60;

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            const pollUrl = `https://api.wavespeed.ai/api/v3/predictions/${predictionId}/result`;
            const pollResponse = await axios.get(pollUrl, {
                headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
                timeout: 15000
            });

            const pollData = pollResponse.data.data || pollResponse.data;
            if (pollData.outputs && pollData.outputs.length > 0) {
                videoUrl = pollData.outputs[0];
                break;
            }
        } catch (err) {
            console.warn(`  [WaveSpeed] Poll ${i + 1} failed, retrying...`);
        }
    }

    if (!videoUrl) {
        throw new Error('WaveSpeed timeout - no video generated');
    }

    // Download the video
    const videoResponse = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 120000
    });
    await fs.writeFile(outputPath, Buffer.from(videoResponse.data));

    console.log(`  [WaveSpeed] ✅ Face video complete`);
}

// Generate Ken Burns asset video with audio overlay
async function generateAssetVideo(
    assetUrl: string,
    audioUrl: string,
    outputPath: string,
    tempDir: string
): Promise<void> {
    console.log(`  [Asset] Generating Ken Burns video with audio...`);

    // Download asset
    const assetPath = path.join(tempDir, `asset_${Date.now()}.jpg`);
    const assetResponse = await axios.get(assetUrl, { responseType: 'arraybuffer' });
    await fs.writeFile(assetPath, Buffer.from(assetResponse.data));

    // Download audio
    const audioPath = path.join(tempDir, `audio_${Date.now()}.mp3`);
    const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    await fs.writeFile(audioPath, Buffer.from(audioResponse.data));

    // Get audio duration
    const { stdout: durationStr } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
    );
    const duration = parseFloat(durationStr.trim());
    const frameCount = Math.floor(duration * 30);

    // FFmpeg: Ken Burns effect with audio
    const vf = [
        "scale=1080:1920:force_original_aspect_ratio=decrease",
        "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
        `zoompan=z='1+0.1*on/${frameCount}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frameCount}:s=1080x1920:fps=30`
    ].join(',');

    await execWithTimeout(
        `ffmpeg -y -loop 1 -i "${assetPath}" -i "${audioPath}" -vf "${vf}" -c:v libx264 -preset fast -pix_fmt yuv420p -c:a aac -shortest "${outputPath}"`,
        120000,
        'Asset Video'
    );

    console.log(`  [Asset] ✅ Asset video complete (${duration.toFixed(2)}s)`);
}

// Generate ASS captions
function generateASSContent(wordTimings: WordTiming[]): string {
    const header = `[Script Info]
Title: Scene Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
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

        const formatTime = (s: number) => {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            return `${h}:${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
        };

        events.push(`Dialogue: 0,${formatTime(phraseStart)},${formatTime(phraseEnd)},Default,,0,0,0,,${text}`);
    }

    return header + events.join('\n');
}

export async function POST(request: NextRequest) {
    const tempDir = path.join(os.tmpdir(), `scene-face-${Date.now()}`);

    // Extract base URL for internal API calls
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    try {
        const {
            scenes,
            faceImageUrl,
            voiceId,
            enableBackgroundMusic,
            enableCaptions
        } = await request.json() as {
            scenes: SceneInput[];
            faceImageUrl: string;
            voiceId: string;
            enableBackgroundMusic?: boolean;
            enableCaptions?: boolean;
        };

        if (!scenes || scenes.length === 0 || !faceImageUrl || !voiceId) {
            return NextResponse.json(
                { error: 'Missing required fields: scenes, faceImageUrl, voiceId' },
                { status: 400 }
            );
        }

        console.log('🎬 Scene-based face video generation:');
        console.log(`  - Scenes: ${scenes.length}`);
        console.log(`  - Face scenes: ${scenes.filter(s => s.type === 'face').length}`);
        console.log(`  - Asset scenes: ${scenes.filter(s => s.type === 'asset').length}`);
        console.log(`  - Base URL: ${baseUrl}`);

        await fs.mkdir(tempDir, { recursive: true });

        // Prepare face image as data URL
        let imageDataUrl: string;
        if (faceImageUrl.startsWith('data:')) {
            imageDataUrl = faceImageUrl;
        } else {
            const imgResponse = await axios.get(faceImageUrl, { responseType: 'arraybuffer' });
            const imgBase64 = Buffer.from(imgResponse.data).toString('base64');
            const mimeType = imgResponse.headers['content-type'] || 'image/jpeg';
            imageDataUrl = `data:${mimeType};base64,${imgBase64}`;
        }

        // Process each scene
        const sceneVideoPaths: string[] = [];
        const allWordTimings: WordTiming[] = [];
        let currentTimeOffset = 0;

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            console.log(`\n📍 Scene ${i + 1}/${scenes.length}: ${scene.type.toUpperCase()}`);
            console.log(`   Text: "${scene.text.substring(0, 60)}..."`);

            // 1. Generate TTS for this scene (calls fal.ai directly)
            const { audioUrl, duration } = await generateSceneTTS(scene.text, voiceId);

            // 2. Generate word timings for this scene (estimate based on duration)
            const words = scene.text.split(/\s+/).filter(w => w.length > 0);
            const timePerWord = duration / words.length;
            for (let w = 0; w < words.length; w++) {
                allWordTimings.push({
                    word: words[w],
                    start: currentTimeOffset + (w * timePerWord),
                    end: currentTimeOffset + ((w + 1) * timePerWord)
                });
            }

            // 3. Generate video for this scene
            const sceneVideoPath = path.join(tempDir, `scene_${i}.mp4`);

            if (scene.type === 'face') {
                // WaveSpeed face video
                await generateFaceVideo(imageDataUrl, audioUrl, sceneVideoPath);
            } else {
                // Ken Burns asset video with audio
                const assetUrl = scene.assetUrl || faceImageUrl; // Fallback to face if no asset
                await generateAssetVideo(assetUrl, audioUrl, sceneVideoPath, tempDir);
            }

            sceneVideoPaths.push(sceneVideoPath);
            currentTimeOffset += duration;
        }

        // Concatenate all scene videos
        console.log('\n🔗 Concatenating all scenes...');
        const concatListPath = path.join(tempDir, 'concat.txt');
        const concatContent = sceneVideoPaths.map(p => `file '${p}'`).join('\n');
        await fs.writeFile(concatListPath, concatContent);

        const concatenatedPath = path.join(tempDir, 'concatenated.mp4');
        await execWithTimeout(
            `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -preset fast -c:a aac "${concatenatedPath}"`,
            300000, // 5 minutes for concatenation
            'Concat'
        );

        let outputPath = concatenatedPath;

        // Add background music if enabled
        if (enableBackgroundMusic) {
            const bgMusicPath = path.join(process.cwd(), 'public', 'Feeling Blue.mp3');
            try {
                await fs.access(bgMusicPath);
                const withMusicPath = path.join(tempDir, 'with_music.mp4');
                await execWithTimeout(
                    `ffmpeg -y -i "${outputPath}" -stream_loop -1 -i "${bgMusicPath}" -filter_complex "[0:a]volume=1.0[voice];[1:a]volume=0.15[music];[voice][music]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -shortest "${withMusicPath}"`,
                    180000,
                    'Background Music'
                );
                outputPath = withMusicPath;
            } catch (err) {
                console.warn('  ⚠️ Background music failed:', err);
            }
        }

        // Add captions if enabled
        if (enableCaptions && allWordTimings.length > 0) {
            const assContent = generateASSContent(allWordTimings);
            const assPath = path.join(tempDir, 'captions.ass');
            await fs.writeFile(assPath, assContent);

            const finalPath = path.join(tempDir, 'output.mp4');
            await execWithTimeout(
                `ffmpeg -y -i "${outputPath}" -vf "ass='${assPath}'" -c:v libx264 -preset fast -crf 23 -c:a copy "${finalPath}"`,
                300000,
                'Captions'
            );
            outputPath = finalPath;
        }

        // Read final video
        const videoBuffer = await fs.readFile(outputPath);
        const videoBase64 = videoBuffer.toString('base64');

        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });

        console.log('\n🎬 Scene-based video complete!');
        console.log(`   Total duration: ${currentTimeOffset.toFixed(2)}s`);

        return NextResponse.json({
            videoUrl: `data:video/mp4;base64,${videoBase64}`,
            duration: currentTimeOffset
        });

    } catch (error) {
        console.error('Error in scene-based video:', error);

        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }

        return NextResponse.json(
            { error: `Failed to generate scene-based video: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
