import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

interface WordTiming {
    word: string;
    start: number;
    end: number;
}

// Generate ASS subtitle with karaoke-style highlighting
function generateASSContent(wordTimings: WordTiming[]): string {
    const header = `[Script Info]
Title: Caption Video
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,72,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,2,5,60,60,400,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const events: string[] = [];
    const wordsPerLine = 4;

    for (let lineStart = 0; lineStart < wordTimings.length; lineStart += wordsPerLine) {
        const lineWords = wordTimings.slice(lineStart, lineStart + wordsPerLine);
        if (lineWords.length === 0) continue;

        for (let i = 0; i < lineWords.length; i++) {
            const word = lineWords[i];
            const wordStart = word.start;
            const wordEnd = word.end;

            const textParts = lineWords.map((w, idx) => {
                if (idx === i) {
                    return `{\\c&H00D4FF&\\fs80}${w.word}{\\c&HFFFFFF&\\fs72}`;
                }
                return w.word;
            });

            const text = textParts.join(' ');
            const startFormatted = formatASSTime(wordStart);
            const endFormatted = formatASSTime(wordEnd);

            events.push(`Dialogue: 0,${startFormatted},${endFormatted},Default,,0,0,0,,${text}`);
        }
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
    const tempDir = path.join(os.tmpdir(), `post-process-${Date.now()}`);

    try {
        const { videoUrl, enableBackgroundMusic, wordTimings } = await request.json() as {
            videoUrl: string;
            enableBackgroundMusic?: boolean;
            wordTimings?: WordTiming[];
        };

        if (!videoUrl) {
            return NextResponse.json(
                { error: 'Missing video URL' },
                { status: 400 }
            );
        }

        const hasCaptions = wordTimings && wordTimings.length > 0;
        console.log(`Post-processing video: ${hasCaptions ? `captions (${wordTimings.length} words)` : 'no captions'}, ${enableBackgroundMusic ? 'with music' : 'no music'}`);

        // Create temp directory
        await fs.mkdir(tempDir, { recursive: true });

        // Download video or extract from data URL
        const videoPath = path.join(tempDir, 'input.mp4');

        if (videoUrl.startsWith('data:')) {
            const base64Data = videoUrl.split(',')[1];
            const videoBuffer = Buffer.from(base64Data, 'base64');
            await fs.writeFile(videoPath, videoBuffer);
        } else {
            const response = await fetch(videoUrl);
            const arrayBuffer = await response.arrayBuffer();
            await fs.writeFile(videoPath, Buffer.from(arrayBuffer));
        }

        // Background music path
        const bgMusicPath = path.join(process.cwd(), 'public', 'Feeling Blue.mp3');
        let bgMusicExists = false;

        if (enableBackgroundMusic) {
            try {
                await fs.access(bgMusicPath);
                bgMusicExists = true;
            } catch {
                console.warn('Background music file not found at:', bgMusicPath);
            }
        }

        // Output path
        const outputPath = path.join(tempDir, 'output.mp4');

        let ffmpegCmd: string;

        // Build FFmpeg command based on options
        if (hasCaptions && bgMusicExists) {
            // Both captions and music
            const assContent = generateASSContent(wordTimings!);
            const assPath = path.join(tempDir, 'subtitles.ass');
            await fs.writeFile(assPath, assContent);

            ffmpegCmd = `ffmpeg -y \
                -i "${videoPath}" \
                -stream_loop -1 -i "${bgMusicPath}" \
                -filter_complex "[0:a]volume=1.0[voice];[1:a]volume=0.15[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]" \
                -map 0:v -map "[aout]" \
                -vf "ass='${assPath}'" \
                -c:v libx264 -preset fast -crf 23 \
                -c:a aac -b:a 128k \
                -shortest \
                -movflags +faststart \
                "${outputPath}"`;
        } else if (hasCaptions) {
            // Only captions
            const assContent = generateASSContent(wordTimings!);
            const assPath = path.join(tempDir, 'subtitles.ass');
            await fs.writeFile(assPath, assContent);

            ffmpegCmd = `ffmpeg -y \
                -i "${videoPath}" \
                -vf "ass='${assPath}'" \
                -c:v libx264 -preset fast -crf 23 \
                -c:a copy \
                -movflags +faststart \
                "${outputPath}"`;
        } else if (bgMusicExists) {
            // Only music
            ffmpegCmd = `ffmpeg -y \
                -i "${videoPath}" \
                -stream_loop -1 -i "${bgMusicPath}" \
                -filter_complex "[0:a]volume=1.0[voice];[1:a]volume=0.15[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]" \
                -map 0:v -map "[aout]" \
                -c:v copy \
                -c:a aac -b:a 128k \
                -shortest \
                -movflags +faststart \
                "${outputPath}"`;
        } else {
            // Nothing to do, just copy
            ffmpegCmd = `ffmpeg -y -i "${videoPath}" -c copy "${outputPath}"`;
        }

        console.log('Running FFmpeg post-processing...');
        await execAsync(ffmpegCmd);
        console.log('FFmpeg completed successfully');

        // Read the output video
        const videoBuffer = await fs.readFile(outputPath);
        const videoBase64 = videoBuffer.toString('base64');

        // Clean up temp files
        await fs.rm(tempDir, { recursive: true, force: true });

        // Return as data URL
        const resultUrl = `data:video/mp4;base64,${videoBase64}`;

        return NextResponse.json({
            videoUrl: resultUrl,
        });

    } catch (error) {
        console.error('Error post-processing video:', error);

        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }

        return NextResponse.json(
            { error: `Failed to post-process video: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
