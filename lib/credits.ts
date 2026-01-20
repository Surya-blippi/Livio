/**
 * Credit costs for various operations
 * Based on ~65% profit margin calculations
 * 
 * Base rate: 1 User Credit = $0.01
 */

export const CREDIT_COSTS = {
    // Manus AI operations
    RESEARCH_SCRIPT: 50,      // $0.50 - Manus research (35 Manus credits = $0.175)
    ASSET_COLLECTION: 50,     // $0.50 - Manus asset collection (35 Manus credits = $0.175)

    // Video generation
    FACE_VIDEO_SCENE: 100,    // $1.00 - WaveSpeed per scene (~$0.35 cost)
    VIDEO_RENDER: 80,         // $0.80 - JSON2Video render (40 J2V credits = $0.28)

    // Audio & Voice
    AUDIO_PER_1000_CHARS: 30, // $0.30 - FAL MiniMax audio ($0.10 cost)
    VOICE_CLONING: 300,       // $3.00 - FAL voice clone ($1.00 cost)

    // Image generation
    AI_IMAGE: 45,             // $0.45 - FAL Nano Banana ($0.15 cost)
    MOTION_SCENE_IMAGE: 40,   // $0.40 - Motion editing scene image
} as const;

export type CreditOperation = keyof typeof CREDIT_COSTS;

/**
 * Calculate credits needed for script audio generation
 */
export function calculateAudioCredits(charCount: number): number {
    return Math.ceil(charCount / 1000) * CREDIT_COSTS.AUDIO_PER_1000_CHARS;
}

/**
 * Calculate total credits for a face video with multiple scenes
 */
export function calculateFaceVideoCredits(sceneCount: number): number {
    return sceneCount * CREDIT_COSTS.FACE_VIDEO_SCENE;
}

/**
 * Calculate total credits for faceless video generation
 * Matches backend: (sceneCount × 30) + 80 render fee
 */
export function calculateFacelessVideoCredits(sceneCount: number): number {
    return (sceneCount * CREDIT_COSTS.AUDIO_PER_1000_CHARS) + CREDIT_COSTS.VIDEO_RENDER;
}

/**
 * Estimate total credits for a complete video generation flow
 */
export function estimateTotalCredits(options: {
    mode: 'face' | 'faceless';
    scriptCharCount: number;
    sceneCount?: number;
    includeResearch?: boolean;
    includeAssetCollection?: boolean;
    requiresVoiceCloning?: boolean;
}): number {
    let total = 0;

    if (options.includeResearch) {
        total += CREDIT_COSTS.RESEARCH_SCRIPT;
    }

    if (options.includeAssetCollection) {
        total += CREDIT_COSTS.ASSET_COLLECTION;
    }

    if (options.requiresVoiceCloning) {
        total += CREDIT_COSTS.VOICE_CLONING;
    }

    if (options.mode === 'face' && options.sceneCount) {
        total += calculateFaceVideoCredits(options.sceneCount);
    } else if (options.mode === 'faceless') {
        // Faceless now uses scene count for calculation (30/scene + 80 render)
        // Default to 1 scene if not provided to avoid 0 cost
        const count = options.sceneCount && options.sceneCount > 0 ? options.sceneCount : 1;
        total += calculateFacelessVideoCredits(count);
    }

    return total;
}

/**
 * Credit package definitions for purchase
 * Prices must match DodoPayments dashboard products
 */
export const CREDIT_PACKAGES = [
    { id: 'starter', name: 'Starter', credits: 2000, price: 19, bonus: 100 },
    { id: 'pro', name: 'Pro', credits: 5000, price: 39, bonus: 500 },
    { id: 'studio', name: 'Studio', credits: 12000, price: 79, bonus: 2000 },
] as const;
