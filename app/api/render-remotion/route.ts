import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { getCaptionStyle, CaptionStyle } from '@/lib/captionStyles';

const execAsync = promisify(exec);

interface WordTiming {
    word: string;
    start: number;
    end: number;
}

// Scene timing interface for scene-based styling
interface SceneTimingForCaptions {
    sceneIndex: number;
    startTime: number;
    endTime: number;
}

// Dynamic color palettes for scenes (BGR format for ASS)
const SCENE_STYLES = [
    { highlight: '00D4FF', base: 'FFFFFF', name: 'Gold' },      // Yellow/Gold highlight
    { highlight: 'FFFF00', base: 'FFFFFF', name: 'Cyan' },      // Cyan highlight  
    { highlight: 'FF00FF', base: 'FFFFFF', name: 'Magenta' },   // Magenta highlight
    { highlight: '00FF00', base: 'FFFFFF', name: 'Lime' },      // Lime highlight
    { highlight: '7F7FFF', base: 'FFFFFF', name: 'Coral' },     // Coral highlight
    { highlight: 'FF7F00', base: 'FFFFFF', name: 'DeepSky' },   // Deep Sky Blue
];

// Format time for ASS subtitles (H:MM:SS.CC format)
function formatASSTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

// Get scene index for a given time
function getSceneIndexForTime(time: number, sceneTimings: SceneTimingForCaptions[]): number {
    for (const scene of sceneTimings) {
        if (time >= scene.startTime && time <= scene.endTime) {
            return scene.sceneIndex;
        }
    }
    return 0; // Default to first scene style
}

// Group words into phrases (3-5 words for smooth reading)
function createCaptionPhrases(wordTimings: WordTiming[], wordsPerPhrase: number = 4): { words: WordTiming[], start: number, end: number, text: string }[] {
    const phrases: { words: WordTiming[], start: number, end: number, text: string }[] = [];

    for (let i = 0; i < wordTimings.length; i += wordsPerPhrase) {
        const phraseWords = wordTimings.slice(i, i + wordsPerPhrase);
        if (phraseWords.length > 0) {
            const phraseText = phraseWords
                .map(w => w.word.replace(/[{}\\]/g, ''))
                .join(' ');
            phrases.push({
                words: phraseWords,
                start: phraseWords[0].start,
                end: phraseWords[phraseWords.length - 1].end,
                text: phraseText
            });
        }
    }

    return phrases;
}

// Generate ASS content with smooth gliding phrase transitions
function generateTikTokASS(wordTimings: WordTiming[], width: number, height: number, sceneTimings: SceneTimingForCaptions[] = [], captionStyleConfig: CaptionStyle): string {
    // 4 words per phrase for natural reading
    const phrases = createCaptionPhrases(wordTimings, 4);

    // Position captions at BOTTOM of screen (200px from bottom edge for better visibility)
    const marginV = 200;

    // Get style config
    const font = captionStyleConfig.font;
    const fontSize = captionStyleConfig.fontSize;
    const primaryColor = captionStyleConfig.primaryColor;
    const outlineColor = captionStyleConfig.outlineColor;
    const shadowColor = captionStyleConfig.shadowColor;
    const outlineWidth = captionStyleConfig.outlineWidth;
    const shadowDepth = captionStyleConfig.shadowDepth;
    const bold = captionStyleConfig.bold ? 1 : 0;

    // Premium ASS Header with dynamic font from style
    let ass = `[Script Info]
Title: Styled Captions - ${captionStyleConfig.name}
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0
ScaledBorderAndShadow: yes
Collisions: Normal

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${fontSize},${primaryColor},${primaryColor},${outlineColor},${shadowColor},${bold},0,0,0,100,100,2,0,1,${outlineWidth},${shadowDepth},2,50,50,${marginV},1
Style: FadeIn,${font},${fontSize},${primaryColor},${primaryColor},${outlineColor},${shadowColor},${bold},0,0,0,100,100,2,0,1,${outlineWidth},${shadowDepth},2,50,50,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const hasSceneTimings = sceneTimings.length > 0;
    if (hasSceneTimings) {
        console.log(`[ASS] Using dynamic scene-based styling with ${sceneTimings.length} scenes`);
    }

    // Generate smooth gliding phrases with animation based on style
    for (let phraseIdx = 0; phraseIdx < phrases.length; phraseIdx++) {
        const phrase = phrases[phraseIdx];
        const phraseStart = phrase.start;
        // Phrase ends when next phrase starts, or with buffer at end
        const phraseEnd = phraseIdx < phrases.length - 1
            ? phrases[phraseIdx + 1].start
            : phrase.end + 0.5;

        // Create animation based on style
        let fadeEffect = '';
        switch (captionStyleConfig.animation) {
            case 'pop':
                fadeEffect = `{\\fad(150,100)\\t(0,100,\\fscx105\\fscy105)\\t(100,200,\\fscx100\\fscy100)}`;
                break;
            case 'bounce':
                fadeEffect = `{\\fad(100,100)\\t(0,80,\\fscx110\\fscy110)\\t(80,160,\\fscx95\\fscy95)\\t(160,240,\\fscx100\\fscy100)}`;
                break;
            case 'glow':
                fadeEffect = `{\\fad(200,150)\\blur2\\t(0,200,\\blur0)}`;
                break;
            case 'slide':
                fadeEffect = `{\\fad(100,100)\\move(${width / 2 - 50},${marginV},${width / 2},${marginV},0,150)}`;
                break;
            case 'fade':
            default:
                fadeEffect = `{\\fad(200,150)}`;
                break;
        }

        const text = `${fadeEffect}${phrase.text}`;

        ass += `Dialogue: 0,${formatASSTime(phraseStart)},${formatASSTime(phraseEnd)},Default,,0,0,0,,${text}\n`;
    }

    console.log(`[ASS] Generated ${phrases.length} phrases with ${captionStyleConfig.name} style`);

    return ass;
}

// Scene timing interface for scene-based video generation
interface SceneTiming {
    sceneIndex: number;
    text: string;
    keywords: string[];
    startTime: number;
    endTime: number;
}

export async function POST(request: NextRequest) {
    const tempDir = path.join(os.tmpdir(), `video-${Date.now()}`);

    try {
        const {
            audioBase64,
            wordTimings,
            duration,
            images = [],
            aspectRatio = '9:16',
            enableBackgroundMusic = false,
            sceneTimings = [],
            captionStyle = 'bold-classic'
        } = await request.json() as {
            audioBase64: string;
            wordTimings: WordTiming[];
            duration: number;
            images?: string[];
            aspectRatio?: '9:16' | '16:9' | '1:1';
            enableBackgroundMusic?: boolean;
            sceneTimings?: SceneTiming[];
            captionStyle?: string;
        };

        // Get the caption style configuration
        const captionStyleConfig = getCaptionStyle(captionStyle);

        if (!audioBase64) {
            return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
        }

        // Create temp directory
        await fs.mkdir(tempDir, { recursive: true });

        // Save audio to temp file
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        const audioPath = path.join(tempDir, 'audio.mp3');
        await fs.writeFile(audioPath, audioBuffer);

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

        // Calculate image area (square in center for 9:16)
        const squareSize = Math.min(width, height);
        const topOffset = Math.floor((height - squareSize) / 2);

        // Download and process images
        const localImagePaths: string[] = [];
        for (let i = 0; i < images.length; i++) {
            try {
                const imageUrl = images[i];
                const response = await fetch(imageUrl);
                if (response.ok) {
                    const buffer = Buffer.from(await response.arrayBuffer());
                    const rawPath = path.join(tempDir, `raw_${i}.jpg`);
                    await fs.writeFile(rawPath, buffer);

                    // Resize image to fit in square
                    const imagePath = path.join(tempDir, `image_${i}.jpg`);
                    const resizeCmd = `ffmpeg -y -i "${rawPath}" -vf "scale=${squareSize}:${squareSize}:force_original_aspect_ratio=decrease,pad=${squareSize}:${squareSize}:(ow-iw)/2:(oh-ih)/2:black" "${imagePath}"`;
                    await execAsync(resizeCmd);
                    localImagePaths.push(imagePath);
                }
            } catch (err) {
                console.error(`Failed to process image ${i}:`, err);
            }
        }

        console.log(`Creating video: ${width}x${height}, ${duration}s, ${localImagePaths.length} images, ${wordTimings.length} words, music: ${enableBackgroundMusic}`);
        if (sceneTimings.length > 0) {
            console.log(`Using scene-based timing with ${sceneTimings.length} scenes`);
        }

        const outputPath = path.join(tempDir, 'output.mp4');
        const baseVideoPath = path.join(tempDir, 'base.mp4');
        const musicVideoPath = path.join(tempDir, 'with_music.mp4');

        // Step 1: Create base video with images and audio
        if (localImagePaths.length > 0) {
            // Add buffer to duration to avoid audio cutoff
            const paddedDuration = duration + 3;

            // Calculate image durations - use scene timings if available
            let imageDurations: number[];

            if (sceneTimings.length > 0 && sceneTimings.length === localImagePaths.length) {
                // Use scene timings for perfect sync
                console.log('Using scene-based image timing:');
                imageDurations = sceneTimings.map((scene, i) => {
                    const sceneDuration = scene.endTime - scene.startTime;
                    console.log(`  Image ${i + 1}: ${sceneDuration.toFixed(2)}s (Scene: ${scene.startTime.toFixed(2)}s - ${scene.endTime.toFixed(2)}s)`);
                    return sceneDuration;
                });

                // Adjust last image to fill remaining time (for buffer)
                const totalSceneDuration = imageDurations.reduce((a, b) => a + b, 0);
                const remainingTime = paddedDuration - totalSceneDuration;
                if (remainingTime > 0) {
                    imageDurations[imageDurations.length - 1] += remainingTime;
                }
            } else {
                // Fall back to equal distribution
                const durationPerImage = paddedDuration / localImagePaths.length;
                imageDurations = localImagePaths.map(() => durationPerImage);
                console.log(`Using equal image timing: ${durationPerImage.toFixed(2)}s per image`);
            }

            const imageInputs = localImagePaths.map((p) => `-i "${p}"`).join(' ');

            // ========== POLISHED REEL-QUALITY VIDEO GENERATION ==========
            console.log('🎬 Generating polished reel-quality video...');

            // Professional Ken Burns settings - SUBTLE and CINEMATIC
            const ZOOM_SPEED = 0.0025;  // Subtle zoom for professional look
            const PAN_SPEED = 1.5;      // Gentle pan speed
            const MAX_ZOOM = 1.25;      // Max 25% zoom for subtle effect
            const CROSSFADE_DURATION = 0.4; // 400ms crossfade between scenes

            // Generate motion filters with SUBTLE, PROFESSIONAL motion
            const scaleFilters = localImagePaths.map((_, i) => {
                // 6 Professional motion effects
                const effects = [
                    'SLOW_ZOOM_IN',
                    'SLOW_ZOOM_OUT',
                    'GENTLE_PAN_RIGHT',
                    'GENTLE_PAN_LEFT',
                    'ZOOM_IN_PAN_RIGHT',
                    'ZOOM_OUT_PAN_LEFT'
                ];
                const effectName = effects[i % effects.length]; // Cycle through effects

                // Duration in frames (30fps for smoother motion)
                const fps = 30;
                const d = Math.ceil(imageDurations[i] * fps);
                const s = `${squareSize}x${squareSize}`;

                let zoom, x, y;

                switch (effectName) {
                    case 'SLOW_ZOOM_IN':
                        // Increased zoom speed (4x faster) for visible effect
                        zoom = `min(pzoom+${ZOOM_SPEED * 4},${MAX_ZOOM})`;
                        x = `iw/2-(iw/zoom/2)`;
                        y = `ih/2-(ih/zoom/2)`;
                        break;
                    case 'SLOW_ZOOM_OUT':
                        zoom = `max(1.0,${MAX_ZOOM}-${ZOOM_SPEED * 4}*on)`;
                        x = `iw/2-(iw/zoom/2)`;
                        y = `ih/2-(ih/zoom/2)`;
                        break;
                    case 'GENTLE_PAN_RIGHT':
                        // Start from left, pan right
                        zoom = `1.15`;
                        x = `min(x+${PAN_SPEED},iw-iw/zoom)`;
                        y = `ih/2-(ih/zoom/2)`;
                        break;
                    case 'GENTLE_PAN_LEFT':
                        // FIX: Start from RIGHT side (iw-iw/zoom), then pan left toward 0
                        zoom = `1.15`;
                        x = `if(eq(on,1),iw-iw/zoom,max(x-${PAN_SPEED},0))`;
                        y = `ih/2-(ih/zoom/2)`;
                        break;
                    case 'ZOOM_IN_PAN_RIGHT':
                        // Increased zoom speed for visible effect
                        zoom = `min(pzoom+${ZOOM_SPEED * 3},${MAX_ZOOM})`;
                        x = `min(x+${PAN_SPEED * 0.7},iw-iw/zoom)`;
                        y = `ih/2-(ih/zoom/2)`;
                        break;
                    case 'ZOOM_OUT_PAN_LEFT':
                        // FIX: Start from right, zoom out while panning left
                        zoom = `max(1.0,${MAX_ZOOM}-${ZOOM_SPEED * 3}*on)`;
                        x = `if(eq(on,1),iw-iw/zoom,max(x-${PAN_SPEED * 0.7},0))`;
                        y = `ih/2-(ih/zoom/2)`;
                        break;
                    default:
                        zoom = `min(pzoom+${ZOOM_SPEED * 4},${MAX_ZOOM})`;
                        x = `iw/2-(iw/zoom/2)`;
                        y = `ih/2-(ih/zoom/2)`;
                }

                console.log(`  Scene ${i + 1}: ${effectName} (${imageDurations[i].toFixed(2)}s, ${d} frames)`);

                // Scale to 4x target for HIGH QUALITY, then zoompan, then color grade
                // eq filter: slight saturation boost (1.15) and contrast boost (1.05) for polished look
                return `[${i}:v]scale=${4 * squareSize}:-1,zoompan=z='${zoom}':x='${x}':y='${y}':d=${d}:s=${s}:fps=${fps},eq=saturation=1.15:contrast=1.05,setsar=1[img${i}]`;
            }).join(';');

            // Pad each clip to full frame size
            const padFilters = localImagePaths.map((_, i) =>
                `[img${i}]pad=${width}:${height}:(ow-iw)/2:${topOffset}:black[pad${i}]`
            ).join(';');

            // Build crossfade chain for smooth transitions
            let xfadeChain = '';
            const xfadeDurationFrames = Math.floor(CROSSFADE_DURATION * 30); // 30fps

            if (localImagePaths.length > 1) {
                // Calculate offsets for each crossfade
                let accumulatedDuration = 0;
                for (let i = 0; i < localImagePaths.length - 1; i++) {
                    const inputA = i === 0 ? `[pad0]` : `[xf${i - 1}]`;
                    const inputB = `[pad${i + 1}]`;
                    const outputLabel = i === localImagePaths.length - 2 ? `[slideshow]` : `[xf${i}]`;

                    // Offset is when the transition starts (in seconds)
                    accumulatedDuration += imageDurations[i] - CROSSFADE_DURATION;
                    const offset = Math.max(0, accumulatedDuration);

                    xfadeChain += `${inputA}${inputB}xfade=transition=fade:duration=${CROSSFADE_DURATION}:offset=${offset.toFixed(2)}${outputLabel};`;
                }
                // Remove trailing semicolon
                xfadeChain = xfadeChain.slice(0, -1);
            } else {
                // Single image, no crossfade needed
                xfadeChain = `[pad0]copy[slideshow]`;
            }

            console.log('✨ Applied crossfade transitions between all scenes');

            const audioIndex = localImagePaths.length;

            const baseCmd = `ffmpeg -y ${imageInputs} -i "${audioPath}" \
        -filter_complex "${scaleFilters};${padFilters};${xfadeChain}" \
        -map "[slideshow]" -map ${audioIndex}:a \
        -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
        -c:a aac -b:a 192k \
        -shortest \
        "${baseVideoPath}"`;

            console.log('🎥 Rendering polished video with crossfades...');
            await execAsync(baseCmd);
        } else {
            const baseCmd = `ffmpeg -y -f lavfi -i color=black:s=${width}x${height}:d=${duration + 3} \
        -i "${audioPath}" \
        -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
        -c:a aac -b:a 128k \
        -shortest \
        "${baseVideoPath}"`;

            await execAsync(baseCmd);
        }

        console.log('Base video created');

        // Step 2: Add background music if enabled
        let videoForCaptions = baseVideoPath;

        if (enableBackgroundMusic) {
            console.log('Adding background music...');

            const bgMusicSource = path.join(process.cwd(), 'public', 'Feeling Blue.mp3');

            try {
                await fs.access(bgMusicSource);
                const bgMusicPath = path.join(tempDir, 'bgmusic.mp3');
                await fs.copyFile(bgMusicSource, bgMusicPath);

                const musicCmd = `ffmpeg -y -i "${baseVideoPath}" -stream_loop -1 -i "${bgMusicPath}" \
        -filter_complex "[0:a]volume=1.0[voice];[1:a]volume=0.12[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]" \
        -map 0:v -map "[aout]" \
        -c:v copy \
        -c:a aac -b:a 128k \
        -shortest \
        "${musicVideoPath}"`;

                await execAsync(musicCmd);
                videoForCaptions = musicVideoPath;
                console.log('Background music added');
            } catch (err) {
                console.warn('Background music file not found, skipping:', err);
            }
        }

        // Step 3: Add TikTok-style animated captions
        if (wordTimings.length > 0) {
            console.log('Adding TikTok-style captions...');

            // Generate ASS subtitle file with scene-based dynamic styling
            const sceneTimingsForCaptions = sceneTimings.map(st => ({
                sceneIndex: st.sceneIndex,
                startTime: st.startTime,
                endTime: st.endTime
            }));
            const assContent = generateTikTokASS(wordTimings, width, height, sceneTimingsForCaptions, captionStyleConfig);
            const assPath = path.join(tempDir, 'captions.ass');
            await fs.writeFile(assPath, assContent);

            console.log('ASS content preview:', assContent.substring(0, 500));

            // Copy custom font to temp dir
            try {
                // Ensure "Birds of Paradise" font is available for FFmpeg
                const fontName = 'Birds of Paradise.ttf';
                const fontSource = path.join(process.cwd(), 'public', fontName);
                const fontDest = path.join(tempDir, 'BirdsOfParadise.ttf');
                await fs.copyFile(fontSource, fontDest);
                console.log(`Copied font ${fontName} to temp dir`);
            } catch (err) {
                console.warn('Failed to copy custom font:', err);
            }

            // Escape paths for FFmpeg
            const escapedAssPath = assPath.replace(/:/g, '\\:').replace(/'/g, "'\\''");
            const escapedFontsDir = tempDir.replace(/:/g, '\\:').replace(/'/g, "'\\''");

            // Burn in ASS subtitles with custom font directory
            const subtitleCmd = `ffmpeg -y -i "${videoForCaptions}" \
        -vf "ass='${escapedAssPath}':fontsdir='${escapedFontsDir}'" \
        -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
        -c:a copy \
        "${outputPath}"`;

            console.log('Subtitle command:', subtitleCmd);
            await execAsync(subtitleCmd);
            console.log('Captions added');
        } else {
            await fs.copyFile(videoForCaptions, outputPath);
        }

        // Read the output video
        const videoBuffer = await fs.readFile(outputPath);
        const videoBase64 = videoBuffer.toString('base64');

        // Clean up
        await fs.rm(tempDir, { recursive: true, force: true });

        const videoUrl = `data:video/mp4;base64,${videoBase64}`;

        return NextResponse.json({
            videoUrl,
            duration: Math.ceil(duration),
        });

    } catch (error) {
        console.error('Error rendering video:', error);

        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }

        return NextResponse.json(
            { error: `Failed to render video: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
