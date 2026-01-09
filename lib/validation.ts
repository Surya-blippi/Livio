/**
 * Validate topic input
 */
export const validateTopic = (topic: string): { valid: boolean; error?: string } => {
    const trimmed = topic.trim();

    if (!trimmed) {
        return {
            valid: false,
            error: 'Topic cannot be empty'
        };
    }

    if (trimmed.length < 3) {
        return {
            valid: false,
            error: 'Topic must be at least 3 characters long'
        };
    }

    if (trimmed.length > 200) {
        return {
            valid: false,
            error: 'Topic must be less than 200 characters'
        };
    }

    return { valid: true };
};

/**
 * Validate script text
 */
export const validateScript = (script: string): { valid: boolean; error?: string } => {
    const trimmed = script.trim();

    if (!trimmed) {
        return {
            valid: false,
            error: 'Script cannot be empty'
        };
    }

    if (trimmed.length < 10) {
        return {
            valid: false,
            error: 'Script is too short. Please add more content.'
        };
    }

    if (trimmed.length > 2000) {
        return {
            valid: false,
            error: 'Script is too long. Please keep it under 2000 characters.'
        };
    }

    return { valid: true };
};

/**
 * Estimate reading time in seconds (assuming 150 words per minute)
 */
export const estimateReadingTime = (text: string): number => {
    const words = text.trim().split(/\s+/).length;
    const wordsPerSecond = 150 / 60; // 150 WPM to words per second
    return Math.ceil(words / wordsPerSecond);
};

/**
 * Validate audio duration (must be at least 10 seconds for voice cloning)
 */
export const validateAudioDuration = (duration: number): { valid: boolean; error?: string } => {
    const MIN_DURATION = 10; // MiniMax requirement

    if (duration < MIN_DURATION) {
        return {
            valid: false,
            error: `Audio must be at least ${MIN_DURATION} seconds long. Current duration: ${duration.toFixed(1)}s`
        };
    }

    if (duration > 120) { // 2 minutes max for reasonable UX
        return {
            valid: false,
            error: 'Audio is too long. Please keep it under 2 minutes.'
        };
    }

    return { valid: true };
};
