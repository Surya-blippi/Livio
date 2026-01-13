/**
 * Centralized Configuration Module
 * Validates environment variables at runtime and provides safe access
 */

// Helper to get required env var with validation
function getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

// Helper to get optional env var with default
function getOptionalEnv(name: string, defaultValue: string): string {
    return process.env[name] || defaultValue;
}

// Lazy-loaded configuration to avoid build-time errors
class Config {
    private static _instance: Config | null = null;

    // API Keys
    readonly wavespeedApiKey: string;
    readonly json2videoApiKey: string;
    readonly falKey: string;
    readonly geminiApiKey: string;
    readonly manusApiKey: string | null;

    // URLs
    readonly supabaseUrl: string;
    readonly appUrl: string;

    private constructor() {
        // These will throw if missing
        this.wavespeedApiKey = getRequiredEnv('NEXT_PUBLIC_WAVESPEED_API_KEY');
        this.json2videoApiKey = getRequiredEnv('JSON2VIDEO_API_KEY');
        this.falKey = getRequiredEnv('FAL_KEY');
        this.geminiApiKey = getRequiredEnv('NEXT_PUBLIC_GEMINI_API_KEY');
        this.supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');

        // Optional
        this.manusApiKey = process.env.MANUS_API_KEY || null;
        this.appUrl = getOptionalEnv('NEXT_PUBLIC_APP_URL', 'https://app.reven.in');
    }

    static get instance(): Config {
        if (!Config._instance) {
            Config._instance = new Config();
        }
        return Config._instance;
    }
}

// Export a function to get config (lazy initialization)
export function getConfig(): Config {
    return Config.instance;
}

// Export individual getters for convenience (will throw if missing)
export function getWavespeedApiKey(): string {
    return getConfig().wavespeedApiKey;
}

export function getJson2VideoApiKey(): string {
    return getConfig().json2videoApiKey;
}

export function getFalKey(): string {
    return getConfig().falKey;
}

export function getGeminiApiKey(): string {
    return getConfig().geminiApiKey;
}

export function getManusApiKey(): string | null {
    return getConfig().manusApiKey;
}

export function getAppUrl(): string {
    return getConfig().appUrl;
}
