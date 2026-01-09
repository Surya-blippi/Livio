import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';

const execAsync = promisify(exec);

interface WordTiming {
    word: string;
    start: number;
    end: number;
}

// Generate ASS subtitle content for face mode (captions at bottom)
function generateFaceASSContent(wordTimings: WordTiming[], width: number = 1080, height: number = 1920): string {
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

    // Group words into phrases
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

export async function POST(request: NextRequest) {
    const tempDir = path.join(os.tmpdir(), `face-post-${Date.now()}`);

    try {
        const {
            videoUrl,
            assets,
            wordTimings,
            enableBackgroundMusic,
            segmentDuration = 4 // seconds per segment
        } = await request.json() as {
            videoUrl: string;
            assets?: string[];
            wordTimings?: WordTiming[];
            enableBackgroundMusic?: boolean;
            segmentDuration?: number;
        };

        if (!videoUrl) {
            return NextResponse.json(
                { error: 'Missing video URL' },
                { status: 400 }
            );
        }

        console.log(`🎬 Face mode post-processing:`);
        console.log(`  - Assets: ${assets?.length || 0}`);
        console.log(`  - Word timings: ${wordTimings?.length || 0}`);
        console.log(`  - Segment duration: ${segmentDuration}s`);
        console.log(`  - Background music: ${enableBackgroundMusic}`);

        await fs.mkdir(tempDir, { recursive: true });

        // Download the face video
        const faceVideoPath = path.join(tempDir, 'face.mp4');

        if (videoUrl.startsWith('data:')) {
            const base64Data = videoUrl.split(',')[1];
            await fs.writeFile(faceVideoPath, Buffer.from(base64Data, 'base64'));
        } else {
            const response = await fetch(videoUrl);
            await fs.writeFile(faceVideoPath, Buffer.from(await response.arrayBuffer()));
        }

        // Get video duration
        const { stdout: probeResult } = await execAsync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${faceVideoPath}"`
        );
        const totalDuration = parseFloat(probeResult.trim());
        console.log(`  - Total duration: ${totalDuration.toFixed(2)}s`);

        let outputPath: string;

        if (assets && assets.length > 0) {
            // Download assets
            const assetPaths: string[] = [];
            for (let i = 0; i < assets.length; i++) {
                const assetPath = path.join(tempDir, `asset_${i}.jpg`);
                try {
                    if (assets[i].startsWith('data:')) {
                        const base64Data = assets[i].split(',')[1];
                        await fs.writeFile(assetPath, Buffer.from(base64Data, 'base64'));
                    } else {
                        const response = await axios.get(assets[i], { responseType: 'arraybuffer' });
                        await fs.writeFile(assetPath, Buffer.from(response.data));
                    }
                    assetPaths.push(assetPath);
                } catch (err) {
                    console.warn(`Failed to download asset ${i}:`, err);
                }
            }

            if (assetPaths.length === 0) {
                console.warn('No assets downloaded, skipping alternation');
                outputPath = faceVideoPath;
            } else {
                // Create alternating video: face → asset → face → asset
                // Strategy: Use xfade between face segments and asset images

                // First, extract audio from face video
                const audioPath = path.join(tempDir, 'audio.aac');
                await execAsync(`ffmpeg -y -i "${faceVideoPath}" -vn -acodec copy "${audioPath}"`);

                // Determine segment count and create segments
                const numSegments = Math.ceil(totalDuration / segmentDuration);
                const segmentPaths: string[] = [];

                console.log(`  - Creating ${numSegments} alternating segments...`);

                for (let i = 0; i < numSegments; i++) {
                    const segmentStart = i * segmentDuration;
                    const segmentEnd = Math.min((i + 1) * segmentDuration, totalDuration);
                    const actualDuration = segmentEnd - segmentStart;

                    if (i % 2 === 0) {
                        // Face segment - extract from face video
                        const segPath = path.join(tempDir, `seg_${i}.mp4`);
                        await execAsync(
                            `ffmpeg -y -ss ${segmentStart} -i "${faceVideoPath}" -t ${actualDuration} -an -c:v libx264 -preset fast "${segPath}"`
                        );
                        segmentPaths.push(segPath);
                    } else {
                        // Asset segment - create image video with Ken Burns
                        const assetIndex = Math.floor(i / 2) % assetPaths.length;
                        const assetPath = assetPaths[assetIndex];
                        const segPath = path.join(tempDir, `seg_${i}.mp4`);

                        // Ken Burns effect on asset (slow zoom in)
                        const frameCount = Math.floor(actualDuration * 30);
                        await execAsync(
                            `ffmpeg -y -loop 1 -i "${assetPath}" -vf "scale=4320:7680,zoompan=z='min(zoom+0.001,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frameCount}:s=1080x1920:fps=30" -t ${actualDuration} -c:v libx264 -preset fast -pix_fmt yuv420p "${segPath}"`
                        );
                        segmentPaths.push(segPath);
                    }
                }

                // Concatenate all segments
                const concatListPath = path.join(tempDir, 'concat.txt');
                const concatContent = segmentPaths.map(p => `file '${p}'`).join('\n');
                await fs.writeFile(concatListPath, concatContent);

                const concatenatedPath = path.join(tempDir, 'concatenated.mp4');
                await execAsync(
                    `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -preset fast "${concatenatedPath}"`
                );

                // Merge audio back
                const withAudioPath = path.join(tempDir, 'with_audio.mp4');
                await execAsync(
                    `ffmpeg -y -i "${concatenatedPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${withAudioPath}"`
                );

                outputPath = withAudioPath;
                console.log(`  ✅ Created alternating face/asset video`);
            }
        } else {
            // No assets, just use face video
            outputPath = faceVideoPath;
        }

        // Add background music if enabled
        if (enableBackgroundMusic) {
            const bgMusicPath = path.join(process.cwd(), 'public', 'Feeling Blue.mp3');
            try {
                await fs.access(bgMusicPath);
                const withMusicPath = path.join(tempDir, 'with_music.mp4');
                await execAsync(
                    `ffmpeg -y -i "${outputPath}" -stream_loop -1 -i "${bgMusicPath}" -filter_complex "[0:a]volume=1.0[voice];[1:a]volume=0.15[music];[voice][music]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -shortest "${withMusicPath}"`
                );
                outputPath = withMusicPath;
                console.log(`  ✅ Added background music`);
            } catch {
                console.warn('Background music file not found');
            }
        }

        // Add captions if word timings provided
        if (wordTimings && wordTimings.length > 0) {
            const assContent = generateFaceASSContent(wordTimings);
            const assPath = path.join(tempDir, 'captions.ass');
            await fs.writeFile(assPath, assContent);

            const finalPath = path.join(tempDir, 'output.mp4');
            await execAsync(
                `ffmpeg -y -i "${outputPath}" -vf "ass='${assPath}'" -c:v libx264 -preset fast -crf 23 -c:a copy "${finalPath}"`
            );
            outputPath = finalPath;
            console.log(`  ✅ Added captions (${wordTimings.length} words)`);
        }

        // Read and return the final video
        const videoBuffer = await fs.readFile(outputPath);
        const videoBase64 = videoBuffer.toString('base64');

        // Clean up
        await fs.rm(tempDir, { recursive: true, force: true });

        console.log(`🎬 Face post-processing complete!`);

        return NextResponse.json({
            videoUrl: `data:video/mp4;base64,${videoBase64}`
        });

    } catch (error) {
        console.error('Error in face post-processing:', error);

        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }

        return NextResponse.json(
            { error: `Failed to post-process face video: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
