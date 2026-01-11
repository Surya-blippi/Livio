import axios from 'axios';

export interface ApiError {
    message: string;
    code?: string;
    details?: unknown;
}

/**
 * Scene structure for video generation
 */
export interface Scene {
    text: string;
    keywords: string[];
}

/**
 * Centralized API error handler
 */
export const handleApiError = (error: unknown): ApiError => {
    if (axios.isAxiosError(error)) {
        return {
            message: error.response?.data?.message || error.message || 'An error occurred',
            code: error.response?.status?.toString(),
            details: error.response?.data
        };
    }

    if (error instanceof Error) {
        return {
            message: error.message
        };
    }

    return {
        message: 'An unknown error occurred'
    };
};

/**
 * Retry logic for API calls
 */
export const withRetry = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
): Promise<T> => {
    let lastError: unknown;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    }

    throw lastError;
};

/**
 * Generate script using Gemini API with specific duration
 * Returns script text and optional scenes for scene-based generation
 */
export const generateScript = async (topic: string, duration: number = 10): Promise<{ script: string; scenes?: Scene[] }> => {
    const response = await axios.post('/api/generate-script', { topic, duration });
    return { script: response.data.script, scenes: response.data.scenes };
};

/**
 * Enhance script using Manus AI research
 * Returns script text and scenes for scene-based generation
 */
export const enhanceScript = async (topic: string, duration: number = 30): Promise<{ script: string; scenes: Scene[] }> => {
    const response = await axios.post('/api/enhance-script', { topic, duration });
    return {
        script: response.data.script,
        scenes: response.data.scenes || []
    };
};

/**
 * Regenerate scenes/storyboard from an existing script
 * Use this when the script has been manually edited
 */
export const regenerateScenes = async (script: string, duration: number = 30): Promise<{ scenes: Scene[] }> => {
    const response = await axios.post('/api/regenerate-scenes', { script, duration });
    return {
        scenes: response.data.scenes || []
    };
};

/**
 * Clone voice using MiniMax FAL (returns voice ID for tracking)
 */
export const cloneVoice = async (audioInput: File | string): Promise<{ voiceId: string; previewUrl: string; audioBase64: string }> => {
    let response;
    let audioBase64 = '';

    if (typeof audioInput === 'string') {
        // Input is a URL
        response = await axios.post('/api/clone-voice', {
            audioUrl: audioInput
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        audioBase64 = ''; // We don't have base64 in this case, but that's fine for the DB if we have the URL
    } else {
        // Input is a File
        const formData = new FormData();
        formData.append('audio', audioInput);

        // Convert to base64 for storage and reuse (browser-compatible)
        const arrayBuffer = await audioInput.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const mimeType = audioInput.type || 'audio/wav';
        audioBase64 = `data:${mimeType};base64,${base64}`;

        response = await axios.post('/api/clone-voice', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    }

    return {
        voiceId: response.data.voiceId,
        previewUrl: response.data.previewUrl || '',
        audioBase64: audioBase64
    };
};

/**
 * Generate speech using a custom voice ID (preferred, faster, cheaper)
 * Returns new voice info if re-cloning was needed
 */
export const generateSpeechWithVoiceId = async (
    script: string,
    customVoiceId: string
): Promise<{
    audioUrl: string;
    reCloned?: boolean;
    newVoiceId?: string;
    newPreviewUrl?: string;
}> => {
    try {
        const response = await axios.post('/api/generate-speech', {
            script,
            customVoiceId: customVoiceId || 'female-01' // Safe fallback
        });

        if (!customVoiceId) {
            console.warn('[TTS] No voice ID provided, fell back to female-01');
        }

        return {
            audioUrl: response.data.audioUrl,
            reCloned: !!response.data.newVoiceId,
            newVoiceId: response.data.newVoiceId,
            newPreviewUrl: response.data.newPreviewUrl
        };
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 410) {
            // Voice expired error - throw specific error for handling
            const voiceExpiredError = new Error('VOICE_EXPIRED');
            (voiceExpiredError as Error & { code?: string }).code = 'VOICE_EXPIRED';
            throw voiceExpiredError;
        }
        throw error;
    }
};

/**
 * Generate speech using the audio file directly (fallback, re-clones voice)
 */
export const generateSpeech = async (script: string, audioFileBase64: string): Promise<string> => {
    const response = await axios.post('/api/generate-speech', {
        script,
        audioFileBase64
    });

    return response.data.audioUrl;
};

/**
 * Create video using WaveSpeed InfiniteTalk
 * Can use either imageFile (for original uploads) or imageUrl (for studio-ready images)
 */
export const createVideo = async (
    imageFile: File | null,
    audioUrl: string,
    resolution: '480p' | '720p' = '720p',
    imageUrl?: string
): Promise<{ predictionId: string }> => {
    const formData = new FormData();

    if (imageUrl) {
        // Use URL-based image (e.g., studio-ready image)
        formData.append('imageUrl', imageUrl);
    } else if (imageFile) {
        // Use file upload
        formData.append('image', imageFile);
    } else {
        throw new Error('Either imageFile or imageUrl must be provided');
    }

    formData.append('audioUrl', audioUrl);
    formData.append('resolution', resolution);

    const response = await axios.post('/api/create-video', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });

    return {
        predictionId: response.data.predictionId
    };
};

/**
 * Poll for video status
 */
export const pollVideoStatus = async (predictionId: string): Promise<{
    status: string;
    videoUrl?: string;
    progress?: number;
}> => {
    const response = await axios.get(`/api/create-video?predictionId=${predictionId}`);
    return response.data;
};

/**
 * Word timing data for captions
 */
export interface WordTiming {
    word: string;
    start: number;
    end: number;
}

/**
 * Scene timing data for scene-based video generation
 */
export interface SceneTiming {
    sceneIndex: number;
    text: string;
    keywords: string[];
    startTime: number;
    endTime: number;
    wordTimings: WordTiming[];
}

/**
 * Generate speech using MiniMax TTS (for faceless mode)
 * Returns audio URL and estimated word-level timing for captions
 */
export const generateFacelessSpeech = async (
    script: string,
    voiceId?: string
): Promise<{
    audioUrl: string;
    remoteAudioUrl: string;  // Original TTS URL for cloud services like JSON2Video
    wordTimings: WordTiming[];
    duration: number;
}> => {
    // Use MiniMax TTS via generate-speech endpoint with Calm Woman voice
    const response = await axios.post('/api/generate-speech', {
        script,
        customVoiceId: voiceId || 'female-01' // Safe fallback if Wise_Woman is invalid
    });

    const audioUrl = response.data.audioUrl;
    // Store original remote URL for cloud services (JSON2Video)
    const remoteAudioUrl = audioUrl;
    // CRITICAL: Get the ACTUAL duration from the TTS API for perfect sync
    const actualDurationMs = response.data.durationMs || 0;
    const actualDuration = actualDurationMs / 1000; // Convert to seconds

    // Fetch audio to convert to base64 data URL
    const audioResponse = await fetch(audioUrl);
    const audioBlob = await audioResponse.blob();
    const audioBase64 = await blobToBase64(audioBlob);
    const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

    // ========== USE WHISPER FOR EXACT WORD TIMINGS ==========
    console.log('[Sync] 🎙️ Calling Whisper for exact word timings...');

    let wordTimings: WordTiming[] = [];
    let finalDuration = actualDuration;

    try {
        // Call Whisper API to get exact word-level timestamps
        const whisperResponse = await axios.post('/api/transcribe-audio', {
            audioUrl: audioUrl // Use the original TTS audio URL
        });

        if (whisperResponse.data.wordTimings && whisperResponse.data.wordTimings.length > 0) {
            wordTimings = whisperResponse.data.wordTimings;
            console.log(`[Sync] ✅ Got ${wordTimings.length} EXACT word timings from Whisper`);

            // Get actual duration from last word timing
            const lastWord = wordTimings[wordTimings.length - 1];
            if (lastWord && lastWord.end > 0) {
                finalDuration = Math.max(finalDuration, lastWord.end);
            }
        } else {
            console.warn('[Sync] ⚠️ Whisper returned no word timings, falling back to estimation');
            wordTimings = estimateWordTimings(script, actualDuration > 0 ? actualDuration : undefined);
        }
    } catch (whisperError) {
        console.error('[Sync] ⚠️ Whisper failed, falling back to estimation:', whisperError);
        wordTimings = estimateWordTimings(script, actualDuration > 0 ? actualDuration : undefined);
    }

    console.log(`[Sync] Generated ${wordTimings.length} word timings across ${finalDuration.toFixed(2)}s`);

    return {
        audioUrl: audioDataUrl,
        remoteAudioUrl,  // Original TTS URL for JSON2Video
        wordTimings,
        duration: finalDuration
    };
};

// Fallback estimation function (used when Whisper fails)
function estimateWordTimings(script: string, duration?: number): WordTiming[] {
    const words = script.split(/\s+/).filter(w => w.length > 0);

    const estimateSyllablesLocal = (word: string): number => {
        const cleaned = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
        if (cleaned.length <= 2) return 1;
        const vowelGroups = cleaned.match(/[aeiouy]+/gi);
        return Math.max(1, vowelGroups ? vowelGroups.length : Math.ceil(cleaned.length / 3));
    };

    const wordSyllables = words.map(estimateSyllablesLocal);
    const totalSyllables = wordSyllables.reduce((a, b) => a + b, 0);

    const finalDuration = duration || (totalSyllables / 3.5);
    const timePerSyllable = finalDuration / totalSyllables;

    const wordTimings: WordTiming[] = [];
    let currentTime = 0;

    for (let i = 0; i < words.length; i++) {
        const wordDuration = wordSyllables[i] * timePerSyllable;
        wordTimings.push({
            word: words[i],
            start: currentTime,
            end: currentTime + wordDuration
        });
        currentTime += wordDuration;
    }

    return wordTimings;
}

// Helper to convert blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
}

// Helper to estimate syllables for timing
function estimateSyllables(word: string): number {
    const cleaned = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (cleaned.length <= 2) return 1;
    const vowelGroups = cleaned.match(/[aeiouy]+/gi);
    return Math.max(1, vowelGroups ? vowelGroups.length : Math.ceil(cleaned.length / 3));
}

/**
 * Generate speech with scene-based timing
 * Returns audio URL and detailed timing for each scene
 */
export const generateSceneBasedSpeech = async (
    scenes: Scene[],
    voiceId?: string
): Promise<{
    audioUrl: string;
    remoteAudioUrl: string;  // Original TTS URL for JSON2Video
    sceneTimings: SceneTiming[];
    wordTimings: WordTiming[];
    duration: number;
}> => {
    // Combine all scene texts for single TTS call
    const fullScript = scenes.map(s => s.text).join(' ');

    // Generate speech for the full script
    const result = await generateFacelessSpeech(fullScript, voiceId);

    // Now calculate scene boundaries based on word timings
    const sceneTimings: SceneTiming[] = [];
    let wordIndex = 0;

    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const sceneWords = scene.text.split(/\s+/).filter(w => w.length > 0);
        const sceneWordTimings: WordTiming[] = [];

        // Get word timings for this scene
        for (let j = 0; j < sceneWords.length && wordIndex < result.wordTimings.length; j++) {
            sceneWordTimings.push(result.wordTimings[wordIndex]);
            wordIndex++;
        }

        if (sceneWordTimings.length > 0) {
            sceneTimings.push({
                sceneIndex: i,
                text: scene.text,
                keywords: scene.keywords,
                startTime: sceneWordTimings[0].start,
                endTime: sceneWordTimings[sceneWordTimings.length - 1].end,
                wordTimings: sceneWordTimings
            });
        }
    }

    console.log(`[Scene Speech] Generated ${sceneTimings.length} scene timings`);
    sceneTimings.forEach((st, i) => {
        console.log(`  Scene ${i + 1}: ${st.startTime.toFixed(2)}s - ${st.endTime.toFixed(2)}s (${st.wordTimings.length} words)`);
    });

    return {
        audioUrl: result.audioUrl,
        remoteAudioUrl: result.remoteAudioUrl,  // Pass through for JSON2Video
        sceneTimings,
        wordTimings: result.wordTimings,
        duration: result.duration
    };
};

// Keep old name as alias for backwards compatibility
export const generateElevenLabsSpeech = generateFacelessSpeech;

/**
 * Generate SRT captions from word timings
 */
export const generateDynamicSRT = (wordTimings: WordTiming[]): string => {
    if (!wordTimings || wordTimings.length === 0) return '';

    const captions: string[] = [];
    let captionIndex = 1;
    const wordsPerCaption = 5; // Group ~5 words per caption line

    for (let i = 0; i < wordTimings.length; i += wordsPerCaption) {
        const chunk = wordTimings.slice(i, i + wordsPerCaption);
        const text = chunk.map(w => w.word).join(' ');
        const startTime = chunk[0].start;
        const endTime = chunk[chunk.length - 1].end;

        const startFormatted = formatSRTTime(startTime);
        const endFormatted = formatSRTTime(endTime);

        captions.push(`${captionIndex}\n${startFormatted} --> ${endFormatted}\n${text}\n`);
        captionIndex++;
    }

    return captions.join('\n');
};

function formatSRTTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Create video with animated captions using scene-based timing
 * Returns a video URL with animated karaoke-style captions
 */
export const createCaptionVideo = async (
    audioBase64: string,
    wordTimings: WordTiming[],
    duration: number,
    enableBackgroundMusic: boolean = false,
    images: string[] = [],
    aspectRatio: '9:16' | '16:9' | '1:1' = '9:16',
    sceneTimings?: SceneTiming[],
    captionStyle: string = 'bold-classic'
): Promise<{
    videoUrl: string;
    duration: number;
}> => {
    const response = await axios.post('/api/render-remotion', {
        audioBase64,
        wordTimings,
        duration,
        enableBackgroundMusic,
        images,
        aspectRatio,
        sceneTimings, // Pass scene timings for scene-based image display
        captionStyle  // Pass caption style for styling
    });

    return {
        videoUrl: response.data.videoUrl,
        duration: response.data.duration
    };
};
/**
 * Post-process a video to add background music and/or captions
 */
export const postProcessVideo = async (
    videoUrl: string,
    enableBackgroundMusic: boolean = false,
    wordTimings: WordTiming[] = []
): Promise<{
    videoUrl: string;
}> => {
    const response = await axios.post('/api/add-music', {
        videoUrl,
        enableBackgroundMusic,
        wordTimings
    });

    return {
        videoUrl: response.data.videoUrl
    };
};

// Keep old name as alias for backwards compatibility
export const addBackgroundMusic = postProcessVideo;

/**
 * Post-process face mode video to alternate with assets and add captions
 */
export const facePostProcess = async (
    videoUrl: string,
    assets: string[] = [],
    wordTimings: WordTiming[] = [],
    enableBackgroundMusic: boolean = false
): Promise<{
    videoUrl: string;
}> => {
    const response = await axios.post('/api/face-post-process', {
        videoUrl,
        assets,
        wordTimings,
        enableBackgroundMusic,
        segmentDuration: 4 // Alternate every 4 seconds
    });

    return {
        videoUrl: response.data.videoUrl
    };
};

/**
 * Generate cost-optimized face video: WaveSpeed only for face segments
 * This reduces WaveSpeed costs by ~50%
 */
export const generateOptimizedFaceVideo = async (
    imageUrl: string,
    audioUrl: string,
    assets: string[] = [],
    wordTimings: WordTiming[] = [],
    enableBackgroundMusic: boolean = false
): Promise<{
    videoUrl: string;
}> => {
    const response = await axios.post('/api/optimized-face-video', {
        imageUrl,
        audioUrl,
        assets,
        wordTimings,
        enableBackgroundMusic,
        segmentDuration: 4
    });

    return {
        videoUrl: response.data.videoUrl
    };
};

/**
 * Scene input for face video generation
 */
export interface SceneInput {
    text: string;
    type: 'face' | 'asset';
    assetUrl?: string;
}

/**
 * Generate scene-based face video with perfect sync
 * Each scene gets its own TTS + video (WaveSpeed for face, Ken Burns for assets)
 */
export const generateSceneFaceVideo = async (
    scenes: SceneInput[],
    faceImageUrl: string,
    voiceId: string,
    enableBackgroundMusic: boolean = false,
    enableCaptions: boolean = false
): Promise<{
    videoUrl: string;
    duration: number;
    clipAssets?: { url: string; source: string }[];
}> => {
    const response = await axios.post('/api/scene-face-video', {
        scenes,
        faceImageUrl,
        voiceId,
        enableBackgroundMusic,
        enableCaptions
    });

    return {
        videoUrl: response.data.videoUrl,
        duration: response.data.duration,
        clipAssets: response.data.clipAssets
    };
};

/**
 * Collected asset from image scraping
 */
export interface CollectedAsset {
    url: string;
    thumbnail: string;
    title: string;
    source: string;
    searchTerm: string;
    isUploaded?: boolean;
}

/**
 * Collect relevant images/assets for a script using Gemini + Apify/Unsplash
 */
export const collectAssets = async (
    script: string,
    topic: string
): Promise<{
    assets: CollectedAsset[];
    searchTerms: string[];
    source: string;
}> => {
    const response = await axios.post('/api/collect-assets', {
        script,
        topic
    });

    return {
        assets: response.data.assets,
        searchTerms: response.data.searchTerms,
        source: response.data.source
    };
};

/**
 * Render video using JSON2Video API (cloud-based, no FFmpeg required)
 * 
 * @param scenes - Array of scenes with imageUrl, audioUrl, duration, text
 * @param wordTimings - Word-level timing data for captions
 * @param options - Render options
 * @param onProgress - Progress callback (0-100)
 * @returns Video URL from JSON2Video CDN
 */
export const renderWithJson2Video = async (
    scenes: { imageUrl: string; audioUrl: string; duration: number; text: string }[],
    wordTimings: WordTiming[],
    options: {
        enableCaptions?: boolean;
        captionStyle?: string;
        enableBackgroundMusic?: boolean;
        audioUrl?: string;  // Main voiceover audio URL
        backgroundMusicUrl?: string;
    } = {},
    onProgress?: (progress: number, status: string) => void
): Promise<{
    videoUrl: string;
    duration: number;
}> => {
    const {
        enableCaptions = true,
        captionStyle = 'bold-classic',
        enableBackgroundMusic = false,
        audioUrl,
        backgroundMusicUrl,
    } = options;

    // Start the render
    onProgress?.(5, 'Starting cloud render...');

    const startResponse = await axios.post('/api/render-json2video', {
        scenes,
        wordTimings,
        enableCaptions,
        captionStyle,
        enableBackgroundMusic,
        audioUrl,
        backgroundMusicUrl,
    });

    if (!startResponse.data.success || !startResponse.data.projectId) {
        throw new Error(startResponse.data.error || 'Failed to start render');
    }

    const projectId = startResponse.data.projectId;
    console.log(`[JSON2Video] Render started: ${projectId}`);
    onProgress?.(10, 'Render queued...');

    // Poll for completion
    const maxWaitMs = 300000; // 5 minutes
    const pollIntervalMs = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

        const statusResponse = await axios.get(`/api/render-json2video?projectId=${projectId}`);
        const { status, progress, videoUrl } = statusResponse.data;

        console.log(`[JSON2Video] Status: ${status}, Progress: ${progress}%`);

        if (status === 'done' && videoUrl) {
            onProgress?.(100, 'Render complete!');

            // Calculate total duration from scenes
            const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0);

            return {
                videoUrl,
                duration: totalDuration,
            };
        }

        if (status === 'error') {
            throw new Error('Render failed on JSON2Video');
        }

        // Update progress (map 0-100 from API to 10-95 for UI)
        const uiProgress = 10 + Math.floor((progress || 0) * 0.85);
        const statusMsg = status === 'rendering' ? 'Rendering video...' : 'Waiting in queue...';
        onProgress?.(uiProgress, statusMsg);
    }

    throw new Error('Render timed out after 5 minutes');
};

/**
 * Create video with captions using JSON2Video (cloud-based alternative to FFmpeg)
 * Drop-in replacement for createCaptionVideo that uses JSON2Video API
 */
export const createCaptionVideoCloud = async (
    audioBase64: string,
    wordTimings: WordTiming[],
    duration: number,
    enableBackgroundMusic: boolean = false,
    images: string[] = [],
    aspectRatio: '9:16' | '16:9' | '1:1' = '9:16',
    sceneTimings?: SceneTiming[],
    captionStyle: string = 'bold-classic',
    onProgress?: (progress: number, status: string) => void,
    remoteAudioUrl?: string,  // Remote audio URL for JSON2Video
    backgroundMusicUrl?: string // Remote background music URL
): Promise<{
    videoUrl: string;
    duration: number;
}> => {
    // Build scenes from sceneTimings or create a single scene
    let scenes: { imageUrl: string; audioUrl: string; duration: number; text: string }[] = [];

    if (sceneTimings && sceneTimings.length > 0 && images.length >= sceneTimings.length) {
        // Scene-based: each scene has its own image and timing
        scenes = sceneTimings.map((st, i) => ({
            imageUrl: images[i] || images[0],
            audioUrl: '', // Audio will be handled separately via remoteAudioUrl
            duration: st.endTime - st.startTime,
            text: st.text,
        }));
    } else if (images.length > 0) {
        // Fallback: distribute duration evenly across images
        const durationPerImage = duration / images.length;
        scenes = images.map((img, i) => ({
            imageUrl: img,
            audioUrl: '',
            duration: durationPerImage,
            text: '',
        }));
    }

    if (scenes.length === 0) {
        throw new Error('At least one image is required for video generation');
    }

    return renderWithJson2Video(scenes, wordTimings, {
        enableCaptions: true,
        captionStyle,
        enableBackgroundMusic,
        audioUrl: remoteAudioUrl,  // Pass the remote audio URL for voiceover
        backgroundMusicUrl, // Pass background music URL
    }, onProgress);
};

/**
 * Scene input for face video job
 */
export interface FaceVideoSceneInput {
    text: string;
    type: 'face' | 'asset';
    assetUrl?: string;
}

/**
 * Job status response
 */
export interface FaceVideoJobStatus {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    progressMessage: string;
    result?: {
        videoUrl: string;
        duration: number;
        clipAssets: { url: string; source: string }[];
    };
    error?: string;
    // Scene progress for checklist UI
    totalScenes?: number;
    currentSceneIndex?: number;
    processedScenesCount?: number;
    isRendering?: boolean;
}


/**
 * Start a face video generation job (returns immediately)
 */
export const startFaceVideoJob = async (
    scenes: FaceVideoSceneInput[],
    faceImageUrl: string,
    voiceId: string,
    enableBackgroundMusic: boolean = false,
    enableCaptions: boolean = true,
    userId?: string
): Promise<{ jobId: string }> => {
    const response = await axios.post('/api/face-video/start', {
        scenes,
        faceImageUrl,
        voiceId,
        enableBackgroundMusic,
        enableCaptions,
        userId
    });

    return { jobId: response.data.jobId };
};

/**
 * Get the status of a face video job
 */
export const getFaceVideoJobStatus = async (jobId: string): Promise<FaceVideoJobStatus> => {
    const response = await axios.get(`/api/face-video/status/${jobId}`);
    return response.data;
};

/**
 * Trigger processing of a face video job
 * This is called client-side to ensure the process runs on Vercel
 */
export const triggerFaceVideoProcess = async (jobId: string): Promise<void> => {
    try {
        // Fire and don't wait for completion - the process will update Supabase
        console.log(`[FaceVideo] Triggering process for job ${jobId}`);
        axios.post('/api/face-video/process', { jobId }).catch((err) => {
            console.log(`[FaceVideo] Trigger request sent (response may be slow):`, err?.message || 'ok');
        });
    } catch {
        // Ignore - polling will catch any issues
    }
};

/**
 * Poll for face video job completion with progress callback
 * Uses aggressive retriggering to drive scene-by-scene processing
 */
export const pollFaceVideoJob = async (
    jobId: string,
    onProgress?: (progress: number, message: string, sceneData?: { totalScenes: number; currentSceneIndex: number; processedScenesCount: number; isRendering: boolean }) => void,
    pollIntervalMs: number = 2000, // Poll status every 2s
    maxPollTimeMs: number = 900000 // 15 minutes max for complex videos
): Promise<{
    videoUrl: string;
    duration: number;
    clipAssets: { url: string; source: string }[];
}> => {
    console.log(`[FaceVideo] Starting poll for job ${jobId}`);

    // Initial trigger to start processing
    await triggerFaceVideoProcess(jobId);

    // Wait a moment for the process to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    const startTime = Date.now();
    let lastTriggerTime = Date.now();
    let consecutiveErrors = 0;

    // Retrigger every 3 seconds to drive scene progression
    const RETRIGGER_INTERVAL_MS = 3000;

    while (Date.now() - startTime < maxPollTimeMs) {
        try {
            const status = await getFaceVideoJobStatus(jobId);
            consecutiveErrors = 0; // Reset on success

            // Report progress with scene data
            if (onProgress) {
                onProgress(status.progress, status.progressMessage, {
                    totalScenes: status.totalScenes || 0,
                    currentSceneIndex: status.currentSceneIndex || 0,
                    processedScenesCount: status.processedScenesCount || 0,
                    isRendering: status.isRendering || false
                });
            }


            // Check for completion
            if (status.status === 'completed' && status.result) {
                console.log(`[FaceVideo] Job ${jobId} completed!`);
                return {
                    videoUrl: status.result.videoUrl,
                    duration: status.result.duration,
                    clipAssets: status.result.clipAssets || []
                };
            }

            // Check for failure
            if (status.status === 'failed') {
                console.error(`[FaceVideo] Job ${jobId} failed:`, status.error);
                throw new Error(status.error || 'Video generation failed');
            }

            // Re-trigger processing frequently to drive scene-by-scene
            // Server has mutex lock + stale lock detection, so safe to trigger often
            if ((status.status === 'pending' || status.status === 'processing') &&
                Date.now() - lastTriggerTime > RETRIGGER_INTERVAL_MS) {
                await triggerFaceVideoProcess(jobId);
                lastTriggerTime = Date.now();
            }
        } catch (pollError) {
            consecutiveErrors++;
            console.error(`[FaceVideo] Poll error (${consecutiveErrors}):`, pollError);

            // If too many consecutive errors, give up
            if (consecutiveErrors > 10) {
                throw new Error('Too many polling errors');
            }
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Video generation timed out after 15 minutes');
};
