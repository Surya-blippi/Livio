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

// Generate ASS subtitle with premium TikTok-style karaoke highlighting
function generateASSContent(wordTimings: WordTiming[], width: number = 1080, height: number = 1920): string {
    // Position captions at BOTTOM of screen (150px from bottom edge)
    const marginV = 150;

    const header = `[Script Info]
Title: TikTok Style Captions
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,2,2,50,50,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const events: string[] = [];
    const wordsPerGroup = 4;

    // Group words into display groups
    const groups: WordTiming[][] = [];
    for (let i = 0; i < wordTimings.length; i += wordsPerGroup) {
        groups.push(wordTimings.slice(i, i + wordsPerGroup));
    }

    // Generate dialogue events for each word in each group
    for (const groupWords of groups) {
        if (groupWords.length === 0) continue;

        for (let i = 0; i < groupWords.length; i++) {
            const word = groupWords[i];

            // Calculate timing: word starts when spoken, ends when next word starts
            const startTime = word.start;
            let endTime = word.end + 0.3; // Small buffer at end
            if (i < groupWords.length - 1) {
                endTime = groupWords[i + 1].start; // End when next word starts
            }
            if (endTime <= startTime) endTime = startTime + 0.15;

            // Build the group text with current word highlighted
            const lineParts: string[] = [];
            for (let j = 0; j < groupWords.length; j++) {
                // Clean word of special characters
                const cleanWord = groupWords[j].word.replace(/[{}\\]/g, '').toUpperCase();

                if (j === i) {
                    // Active word: Yellow with slightly larger size
                    lineParts.push(`{\\c&H00D4FF&\\fs56\\bord4}${cleanWord}{\\c&HFFFFFF&\\fs48\\bord4}`);
                } else {
                    // Inactive word: White
                    lineParts.push(cleanWord);
                }
            }

            const startStr = formatASSTime(startTime);
            const endStr = formatASSTime(endTime);
            const text = lineParts.join(' ');

            events.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${text}`);
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
    const tempDir = path.join(os.tmpdir(), `caption-video-${Date.now()}`);

    try {
        const { audioBase64, wordTimings, duration, enableBackgroundMusic, images, aspectRatio = '9:16' } = await request.json() as {
            audioBase64: string;
            wordTimings: WordTiming[];
            duration: number;
            enableBackgroundMusic?: boolean;
            images?: string[];
            aspectRatio?: '9:16' | '16:9' | '1:1';
        };

        if (!audioBase64) {
            return NextResponse.json({ error: 'Missing audioBase64' }, { status: 400 });
        }

        // Determine dimensions based on aspect ratio
        let width = 1080;
        let height = 1920;
        if (aspectRatio === '16:9') {
            width = 1920;
            height = 1080;
        } else if (aspectRatio === '1:1') {
            width = 1080;
            height = 1080;
        }

        const hasCaptions = wordTimings && wordTimings.length > 0;
        console.log(`Creating video ${hasCaptions ? `with ${wordTimings.length} caption words` : 'without captions'}${enableBackgroundMusic ? ' + background music' : ''}, duration: ${duration}s, aspect ratio: ${aspectRatio} (${width}x${height})`);

        // Create temp directory
        await fs.mkdir(tempDir, { recursive: true });

        // Write audio file
        const audioPath = path.join(tempDir, 'audio.mp3');
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        await fs.writeFile(audioPath, audioBuffer);

        // Output video path
        const outputPath = path.join(tempDir, 'output.mp4');

        // Background music path - located in public folder
        const bgMusicPath = path.join(process.cwd(), 'public', 'Feeling Blue.mp3');

        let ffmpegCmd: string;
        const videoDuration = Math.ceil(duration + 3);

        // Check if background music file exists
        let bgMusicExists = false;
        if (enableBackgroundMusic) {
            try {
                await fs.access(bgMusicPath);
                bgMusicExists = true;
            } catch {
                console.warn('Background music file not found at:', bgMusicPath);
            }
        }

        // ---------- PASS 1: GENERATE BASE VIDEO (Visuals + Audio Mix) ----------
        console.log('Starting Pass 1: Base Video Generation...');

        let videoInput = `-f lavfi -i "color=black:s=${width}x${height}:d=${videoDuration}:r=30"`;
        let videoMap = `-map 0:v`;

        if (images && images.length > 0) {
            console.log(`Processing ${images.length} images for slideshow...`);

            // Create images directory
            const imagesDir = path.join(tempDir, 'images');
            await fs.mkdir(imagesDir, { recursive: true });

            const validImages: string[] = [];

            // Download all images
            for (let i = 0; i < images.length; i++) {
                try {
                    const imageUrl = images[i];
                    if (!imageUrl.startsWith('http')) continue;

                    const response = await fetch(imageUrl);
                    if (!response.ok) continue;

                    const buffer = await response.arrayBuffer();
                    const imagePath = path.join(imagesDir, `img_${i}.jpg`);

                    // Use ffmpeg to resize/crop image to exactly dimensions (fill)
                    const rawPath = path.join(imagesDir, `raw_${i}.jpg`);
                    await fs.writeFile(rawPath, Buffer.from(buffer));

                    // Determine square size (min of width/height) - usually 1080 for 9:16
                    const squareSize = Math.min(width, height);

                    // Resize to fit inside SQUARE box, then pad to full video dimensions with black background
                    const resizeCmd = `ffmpeg -y -i "${rawPath}" -vf "scale=${squareSize}:${squareSize}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black" "${imagePath}"`;
                    await execAsync(resizeCmd);

                    validImages.push(imagePath);
                } catch (err) {
                    console.error(`Failed to process image ${i}:`, err);
                }
            }

            if (validImages.length > 0) {
                console.log(`Successfully processed ${validImages.length} images.`);

                // Create concat file for slideshow
                // Calculate duration per image to match the padded total duration
                // We use videoDuration (duration + 3) to ensure the visual stream is longer than audio
                const durationPerImage = videoDuration / validImages.length;
                const concatListPath = path.join(tempDir, 'slideshow.txt');

                let concatContent = '';
                for (const imgPath of validImages) {
                    concatContent += `file '${imgPath}'\nduration ${durationPerImage}\n`;
                }
                // Repeat last image to prevent black frame at end
                concatContent += `file '${validImages[validImages.length - 1]}'\n`;

                await fs.writeFile(concatListPath, concatContent);

                // Use the slideshow as input
                videoInput = `-f concat -safe 0 -i "${concatListPath}"`;
                // Note: Concat input becomes stream 0 (video)
                videoMap = `-map 0:v`;
            }
        }

        const baseVideoPath = path.join(tempDir, 'base_video.mp4');
        let pass1Cmd = '';

        if (bgMusicExists) {
            pass1Cmd = `ffmpeg -y \
                ${videoInput} \
                -i "${audioPath}" \
                -stream_loop -1 -i "${bgMusicPath}" \
                -filter_complex "[1:a]volume=1.0[voice];[2:a]volume=0.15[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]" \
                ${videoMap} -map "[aout]" \
                -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
                -c:a aac -b:a 128k \
                -shortest \
                "${baseVideoPath}"`;
        } else {
            pass1Cmd = `ffmpeg -y \
                ${videoInput} \
                -i "${audioPath}" \
                -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
                -c:a aac -b:a 128k \
                -shortest \
                "${baseVideoPath}"`;
        }

        console.log('Running Pass 1 FFmpeg...');
        await execAsync(pass1Cmd);
        console.log('Pass 1 completed.');

        // ---------- PASS 2: BURN CAPTIONS (If needed) ----------
        if (hasCaptions) {
            console.log('Starting Pass 2: Burning Captions...');

            // Generate and write ASS subtitle file
            const assContent = generateASSContent(wordTimings, width, height);
            const assPath = path.join(tempDir, 'subtitles.ass');
            await fs.writeFile(assPath, assContent);

            // Debug: Log ASS content preview
            console.log('ASS Content Preview (first 500 chars):', assContent.substring(0, 500));
            console.log('Total ASS events:', assContent.split('Dialogue:').length - 1);

            // Escape path for FFmpeg subtitles filter (handle colons and special chars)
            const escapedAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");

            const pass2Cmd = `ffmpeg -y \
                -i "${baseVideoPath}" \
                -vf "subtitles='${escapedAssPath}'" \
                -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
                -c:a copy \
                -movflags +faststart \
                "${outputPath}"`;

            console.log('Pass 2 FFmpeg command:', pass2Cmd);
            console.log('Running Pass 2 FFmpeg...');
            await execAsync(pass2Cmd);
            console.log('Pass 2 completed.');
        } else {
            console.log('No captions, skipping Pass 2. Renaming base video to output.');
            // Just move base video to output path if no captions
            await fs.rename(baseVideoPath, outputPath);
        }

        // Read the output video
        const videoBuffer = await fs.readFile(outputPath);
        const videoBase64 = videoBuffer.toString('base64');

        // Clean up temp files
        await fs.rm(tempDir, { recursive: true, force: true });

        // Return as data URL
        const videoUrl = `data:video/mp4;base64,${videoBase64}`;

        return NextResponse.json({
            videoUrl,
            duration: Math.ceil(duration),
        });

    } catch (error) {
        console.error('Error creating caption video:', error);

        // Clean up on error
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }

        return NextResponse.json(
            { error: `Failed to create video: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
