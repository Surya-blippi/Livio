/**
 * JSON2Video API Helper Library
 * 
 * Provides types and utilities for interacting with the JSON2Video API
 * to generate videos from scenes, images, audio, and captions.
 */

import axios from 'axios';

const JSON2VIDEO_API_BASE = 'https://api.json2video.com/v2';
const JSON2VIDEO_API_KEY = process.env.JSON2VIDEO_API_KEY!;

// ============ Type Definitions ============

export interface Json2VideoElement {
    type: 'image' | 'video' | 'audio' | 'text' | 'subtitles' | 'voice' | 'component';
    src?: string;
    duration?: number;
    start?: number;
    zoom?: {
        start: number;
        end: number;
        x?: string;
        y?: string;
    };
    pan?: {
        start: string;
        end: string;
    };
    text?: string;
    settings?: Record<string, unknown>;
    style?: string;
    // For text elements
    font_family?: string;
    font_size?: number;
    font_color?: string;
    background_color?: string;
    position?: string;
    y?: number | string;
    // For voice elements
    voice?: string;
    // For subtitles
    subtitles?: {
        style?: string;
        font_size?: number;
        font_color?: string;
        background_color?: string;
        position?: string;
    };
    loop?: boolean;
    volume?: number;
}

// ... existing types ...

// ============ API Functions ============

/**
 * Start a JSON2Video render job
 */
export async function startJson2VideoRender(payload: Json2VideoMovie): Promise<string> {
    console.log('🎬 Starting JSON2Video render...');

    // Add webhook if available
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
        if (!payload.exports) payload.exports = [];
        if (payload.exports.length === 0) payload.exports.push({ destinations: [] });

        const exports = payload.exports as { destinations?: { type: string; endpoint: string }[] }[];
        if (!exports[0].destinations) exports[0].destinations = [];

        // Avoid duplicate webhooks
        if (!exports[0].destinations.some(d => d.type === 'webhook')) {
            exports[0].destinations.push({
                type: 'webhook',
                endpoint: `${appUrl}/api/webhooks/json2video`
            });
        }
    }

    const response = await axios.post(`${JSON2VIDEO_API_BASE}/movies`, payload, {
        headers: { 'x-api-key': JSON2VIDEO_API_KEY, 'Content-Type': 'application/json' }
    });

    const projectId = response.data.project;
    console.log(`📽️ JSON2Video project: ${projectId}`);
    return projectId;
}

/**
 * Poll JSON2Video for status
 */
export async function pollJson2Video(projectId: string): Promise<{ completed: boolean; videoUrl?: string; duration?: number; failed?: boolean; status?: string }> {
    console.log(`🔍 Checking JSON2Video: ${projectId}`);

    try {
        const url = `${JSON2VIDEO_API_BASE}/movies?project=${projectId}&_t=${Date.now()}`;
        const resp = await fetch(url, {
            headers: { 'x-api-key': JSON2VIDEO_API_KEY },
            cache: 'no-store'
        });

        if (!resp.ok) {
            return { completed: false, status: `HTTP ${resp.status}` };
        }

        const status = await resp.json();

        if (status.movie && status.movie.status === 'done') {
            return { completed: true, videoUrl: status.movie.url, duration: status.movie.duration || 30 };
        }

        if (status.movie && status.movie.status === 'error') {
            return { completed: false, failed: true, status: status.movie.message };
        }

        if (status.status === 'done' && status.movie) {
            return { completed: true, videoUrl: status.movie, duration: status.duration || 30 };
        }

        if (status.status === 'error') {
            return { completed: false, failed: true, status: status.message };
        }

        return { completed: false, status: status.status || 'processing' };

    } catch (e) {
        console.error('Poll error:', e instanceof Error ? e.message : e);
        return { completed: false, status: 'connection error' };
    }
}

export interface Json2VideoScene {
    comment?: string;
    duration?: number;
    background_color?: string;
    transition?: {
        style: 'fade' | 'crossfade' | 'wipe' | 'slide';
        duration?: number;
    };
    elements: Json2VideoElement[];
}

export interface Json2VideoMovie {
    resolution?: 'sd' | 'hd' | 'full-hd' | 'full-hd-vertical' | 'custom';
    width?: number;
    height?: number;
    quality?: 'high' | 'medium' | 'low';
    fps?: number;
    draft?: boolean;
    scenes: Json2VideoScene[];
    elements?: any[]; // Movie-level elements
    voice?: string;
    exports?: { destinations: { type?: string; endpoint?: string; id?: string; file?: string }[] }[];
}

export interface Json2VideoResponse {
    success: boolean;
    project?: string;
    message?: string;
    remaining_quota?: number;
}

export interface Json2VideoStatusResponse {
    success: boolean;
    movie?: {
        success: boolean;
        status: 'pending' | 'running' | 'done' | 'error';
        message?: string;
        project?: string;
        url?: string;  // Video URL when done
        duration?: number;
        rendering_time?: number;
    };
    remaining_quota?: {
        time: number;
    };
}

// ============ Input Types (from our app) ============

export interface SceneInput {
    imageUrl: string;
    audioUrl: string;
    duration: number;
    text: string;
}

export interface CaptionWord {
    word: string;
    start: number;
    end: number;
}

export interface RenderInput {
    scenes: SceneInput[];
    wordTimings: CaptionWord[];
    enableCaptions: boolean;
    captionStyle?: string;
    enableBackgroundMusic?: boolean;
    backgroundMusicUrl?: string;
    audioUrl?: string;  // Main voiceover audio URL
}

// ============ API Functions ============

/**
 * Get API key from environment
 */
function getApiKey(): string {
    const key = process.env.JSON2VIDEO_API_KEY;
    if (!key) {
        throw new Error('JSON2VIDEO_API_KEY environment variable is not set');
    }
    return key;
}

/**
 * Convert Ken Burns effect type to JSON2Video zoom/pan settings
 * JSON2Video zoom: positive 1-10 for zoom in, negative -1 to -10 for zoom out
 * Pan directions: left, right, top, bottom, top-left, top-right, bottom-left, bottom-right
 */
function getKenBurnsEffect(sceneIndex: number): {
    zoom?: number;
    pan?: string;
    'fade-in'?: number;
    'fade-out'?: number;
    'pan-distance'?: number;
} {
    const effects = [
        // Slow zoom in with fade
        { zoom: 4, 'fade-in': 0.5, 'fade-out': 0.5 },
        // Pan right with moderate zoom
        { zoom: 3, pan: 'right', 'pan-distance': 0.15, 'fade-in': 0.4, 'fade-out': 0.4 },
        // Slow zoom out
        { zoom: -3, 'fade-in': 0.5, 'fade-out': 0.5 },
        // Pan left with slight zoom
        { zoom: 2, pan: 'left', 'pan-distance': 0.15, 'fade-in': 0.4, 'fade-out': 0.4 },
        // Pan up with zoom in
        { zoom: 4, pan: 'top', 'pan-distance': 0.12, 'fade-in': 0.5, 'fade-out': 0.5 },
        // Strong zoom with pan bottom-right
        { zoom: 5, pan: 'bottom-right', 'pan-distance': 0.1, 'fade-in': 0.4, 'fade-out': 0.4 },
        // Gentle zoom out with pan down
        { zoom: -2, pan: 'bottom', 'pan-distance': 0.1, 'fade-in': 0.5, 'fade-out': 0.5 },
        // Pan top-left with moderate zoom
        { zoom: 3, pan: 'top-left', 'pan-distance': 0.12, 'fade-in': 0.4, 'fade-out': 0.4 },
    ];
    return effects[sceneIndex % effects.length];
}

/**
 * Get caption style settings for JSON2Video subtitles
 * Uses valid style names: classic, classic-progressive, classic-one-word, boxed-line, boxed-word
 */
function getCaptionSettings(styleName: string): Record<string, unknown> {
    const styles: Record<string, Record<string, unknown>> = {
        'bold-classic': {
            'style': 'classic', // Use classic style without box
            'font-family': 'Bangers',
            'font-size': 150, // Large impact size
            'word-color': '#FFD700', // Gold/Yellow
            'line-color': '#FFFFFF', // White for context words
            'outline-color': '#000000', // Black outline
            'outline-width': 2,
            'shadow-color': '#000000',
            'shadow-offset': 5,
            'position': 'bottom-center',
            'max-words-per-line': 3,
        },
        'clean-cut': {
            'style': 'classic-progressive',
            'font-family': 'NotoSans Bold',
            'font-size': 90,
            'word-color': '#000000',
            'line-color': '#555555',
            'outline-color': '#FFFFFF',
            'outline-width': 4,
            'max-words-per-line': 3
        },
        'modern-pop': {
            'style': 'classic-progressive',
            'font-size': 85,
            'font-family': 'Roboto',
            'font-weight': '900',
            'word-color': '#FFFF00',
            'line-color': '#FFFFFF',
            'outline-color': '#000000',
            'outline-width': 4,
            'position': 'bottom-center',
            'max-words-per-line': 4,
        },
        'minimal': {
            'style': 'classic',
            'font-size': 70,
            'font-family': 'Arial',
            'word-color': '#FFFFFF',
            'line-color': '#FFFFFF',
            'outline-color': '#000000',
            'outline-width': 2,
            'position': 'bottom-center',
            'max-words-per-line': 5,
        },
        'vibrant': {
            'style': 'boxed-line',
            'font-size': 95,
            'font-family': 'Oswald Bold',
            'word-color': '#FFD700',
            'box-color': '#FF4500DD',
            'position': 'bottom-center',
            'max-words-per-line': 3,
            'all-caps': true,
        },
    };
    return styles[styleName] || styles['bold-classic'];
}

/**
 * Convert our app's scene format to JSON2Video movie format
 * Uses the correct JSON2Video API v2 schema
 */
export function convertToJson2VideoFormat(input: RenderInput): Json2VideoMovie {
    const scenes: any[] = input.scenes.map((scene, index) => {
        const elements: Record<string, unknown>[] = [];
        const kenBurns = getKenBurnsEffect(index);

        // Add image with Ken Burns effect and transitions
        const imageElement: Record<string, unknown> = {
            type: 'image',
            src: scene.imageUrl,
            resize: 'cover',  // CRITICAL: Fill the canvas, crop if needed
            // Spread all Ken Burns properties (zoom, pan, fade-in, fade-out, pan-distance)
            ...kenBurns,
        };

        elements.push(imageElement);

        // Add audio for this scene
        if (scene.audioUrl) {
            elements.push({
                type: 'audio',
                src: scene.audioUrl,
                start: 0,
            });
        }

        // Add transition click sound (plays at start of scene)
        elements.push({
            type: 'audio',
            src: 'https://tfaumdiiljwnjmfnonrc.supabase.co/storage/v1/object/public/Bgmusic/clickit.mp3',
            start: 0,
            volume: 0.4, // Subtle volume
        });

        // Build scene object - only include valid properties
        const sceneObj: Record<string, unknown> = {
            comment: `Scene ${index + 1}`,
            duration: scene.duration,
            elements,
        };

        return sceneObj;
    });

    // Movie-level elements (span all scenes)
    // These are placed at the movie level, not inside any scene
    const movieElements: Record<string, unknown>[] = [];

    // Add voiceover audio at movie level (spans all scenes)
    if (input.audioUrl) {
        movieElements.push({
            type: 'audio',
            src: input.audioUrl,
            start: 0,
            duration: -1,  // -1 means use intrinsic duration of the audio file
            volume: 1,
        });
    }

    // Add background music at movie level (spans all scenes)
    if (input.enableBackgroundMusic && input.backgroundMusicUrl) {
        movieElements.push({
            type: 'audio',
            src: input.backgroundMusicUrl,
            start: 0,
            duration: -2,  // -2 means match movie duration
            volume: 0.12,  // Low volume to not overpower voiceover
            loop: -1,      // -1 means loop indefinitely
            'fade-in': 1,   // Fade in over 1 second
            'fade-out': 2,  // Fade out over 2 seconds at end
        });
    }

    // Add subtitles at movie level (auto-detect from audio, spans all scenes)
    if (input.enableCaptions) {
        const captionSettings = getCaptionSettings(input.captionStyle || 'bold-classic');

        movieElements.push({
            type: 'subtitles',
            language: 'auto',
            settings: captionSettings,
        });
    }

    return {
        resolution: 'custom',
        width: 1080,
        height: 1920,  // 9:16 vertical for reels
        quality: 'high',
        fps: 30,
        draft: false,
        scenes,
        elements: movieElements,  // Movie-level elements for audio/subtitles
    };
}

// ============ Face Video Types ============

export interface FaceSceneInput {
    url: string;  // URL to video clip (face) or image (asset)
    duration: number;
    text: string;
    sceneType: 'face' | 'asset';  // Determines element type
    audioUrl?: string;  // TTS audio URL for this scene (needed for asset scenes)
}

export interface FaceVideoRenderInput {
    scenes: FaceSceneInput[];
    enableCaptions: boolean;
    captionStyle?: string;
    enableBackgroundMusic?: boolean;
    backgroundMusicUrl?: string;
    audioUrl?: string;  // Full voiceover audio URL (optional, for subtitle sync)
}

/**
 * Convert face video scenes to JSON2Video format
 * Uses video elements for face scenes, image elements with Ken Burns for assets
 */
export function convertFaceVideoToJson2VideoFormat(input: FaceVideoRenderInput): Json2VideoMovie {
    const scenes: any[] = input.scenes.map((scene, index) => {
        const elements: Record<string, unknown>[] = [];

        if (scene.sceneType === 'face') {
            // Face scenes: use video element with proper sizing
            // WaveSpeed videos already have audio baked in
            elements.push({
                type: 'video',
                src: scene.url,
                resize: 'cover',  // Fill canvas, crop if needed
                'media-duration': 'exact',
            });
        } else {
            // Asset scenes: use image element with Ken Burns
            const kenBurns = getKenBurnsEffect(index);
            elements.push({
                type: 'image',
                src: scene.url,
                resize: 'cover',
                ...kenBurns,
            });

            // Add TTS audio for asset scenes (face scenes have audio baked in video)
            if (scene.audioUrl) {
                elements.push({
                    type: 'audio',
                    src: scene.audioUrl,
                    start: 0,
                    duration: -1,  // Use full audio duration
                    volume: 1,
                });
            }
        }

        // Add transition click sound (same as faceless)
        elements.push({
            type: 'audio',
            src: 'https://tfaumdiiljwnjmfnonrc.supabase.co/storage/v1/object/public/Bgmusic/clickit.mp3',
            start: 0,
            volume: 0.4,
        });

        return {
            comment: `Scene ${index + 1}`,
            duration: scene.duration,
            elements,
        };
    });

    // Movie-level elements (audio, subtitles)
    const movieElements: Record<string, unknown>[] = [];

    // Add voiceover audio at movie level if provided
    if (input.audioUrl) {
        movieElements.push({
            type: 'audio',
            src: input.audioUrl,
            start: 0,
            duration: -1,
            volume: 1,
        });
    }

    // Add background music
    if (input.enableBackgroundMusic) {
        const musicUrl = input.backgroundMusicUrl || 'https://tfaumdiiljwnjmfnonrc.supabase.co/storage/v1/object/public/Bgmusic/Feeling%20Blue.mp3';
        movieElements.push({
            type: 'audio',
            src: musicUrl,
            start: 0,
            duration: -2,
            volume: 0.12,
            loop: -1,
            'fade-in': 1,
            'fade-out': 2,
        });
    }

    // Add subtitles
    if (input.enableCaptions) {
        const captionSettings = getCaptionSettings(input.captionStyle || 'bold-classic');
        movieElements.push({
            type: 'subtitles',
            language: 'auto',
            settings: captionSettings,
        });
    }

    return {
        resolution: 'custom',
        width: 1080,
        height: 1920,
        quality: 'high',
        fps: 30,
        draft: false,
        scenes,
        elements: movieElements,
    };
}

/**
 * Generate SRT subtitle content from word timings
 */
export function generateSRT(wordTimings: CaptionWord[], wordsPerPhrase: number = 4): string {
    const phrases: { text: string; start: number; end: number }[] = [];

    for (let i = 0; i < wordTimings.length; i += wordsPerPhrase) {
        const phraseWords = wordTimings.slice(i, i + wordsPerPhrase);
        if (phraseWords.length > 0) {
            phrases.push({
                text: phraseWords.map(w => w.word).join(' '),
                start: phraseWords[0].start,
                end: phraseWords[phraseWords.length - 1].end,
            });
        }
    }

    return phrases.map((phrase, index) => {
        const startTime = formatSrtTime(phrase.start);
        const endTime = formatSrtTime(phrase.end);
        return `${index + 1}\n${startTime} --> ${endTime}\n${phrase.text}\n`;
    }).join('\n');
}

/**
 * Format seconds to SRT time format (HH:MM:SS,mmm)
 */
function formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Start a video render on JSON2Video
 */
export async function startRender(movie: Json2VideoMovie): Promise<Json2VideoResponse> {
    const response = await fetch(`${JSON2VIDEO_API_BASE}/movies`, {
        method: 'POST',
        headers: {
            'x-api-key': getApiKey(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(movie),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`JSON2Video API error: ${response.status} - ${error}`);
    }

    return response.json();
}

/**
 * Poll for render status
 */
export async function getRenderStatus(projectId: string): Promise<{
    success: boolean;
    status: string;
    videoUrl?: string;
    message?: string;
    progress?: number;
}> {
    const response = await fetch(`${JSON2VIDEO_API_BASE}/movies?project=${projectId}`, {
        method: 'GET',
        headers: {
            'x-api-key': getApiKey(),
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`JSON2Video status error: ${response.status} - ${error}`);
    }

    const data: Json2VideoStatusResponse = await response.json();

    // Extract nested movie data
    const movieData = data.movie;

    if (!movieData) {
        return {
            success: data.success,
            status: 'pending',
            message: 'Waiting for movie data...',
        };
    }

    return {
        success: data.success && movieData.success,
        status: movieData.status,
        videoUrl: movieData.url,
        message: movieData.message,
        progress: movieData.status === 'done' ? 100 : (movieData.status === 'running' ? 50 : 10),
    };
}

/**
 * Wait for render to complete with polling
 */
export async function waitForRender(
    projectId: string,
    maxWaitMs: number = 300000,  // 5 minutes default
    pollIntervalMs: number = 2000
): Promise<Json2VideoStatusResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
        const status = await getRenderStatus(projectId);

        if (status.status === 'done') {
            return status;
        }

        if (status.status === 'error') {
            throw new Error(`Render failed: ${status.message}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Render timed out');
}
