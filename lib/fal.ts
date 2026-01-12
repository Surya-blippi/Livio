import { fal } from '@fal-ai/client';

if (!process.env.FAL_KEY) {
    console.warn("FAL_KEY is missing from environment variables.");
}

fal.config({ credentials: process.env.FAL_KEY });

export async function generateSceneTTS(text: string, voiceId: string): Promise<{ audioUrl: string; duration: number }> {
    console.log(`🎤 TTS: "${text.substring(0, 30)}..." (Voice: ${voiceId})`);

    // Default fallback voice if undefined or 'pending'
    const cleanVoiceId = (voiceId && voiceId !== 'pending') ? voiceId : 'Voice3d303ed71767974077';

    try {
        const result = await fal.subscribe('fal-ai/minimax/speech-02-hd', {
            input: {
                text,
                voice_setting: { voice_id: cleanVoiceId, speed: 1, vol: 1, pitch: 0 },
                output_format: 'url'
            },
            logs: false
        }) as unknown as { data: { audio: { url: string }; duration_ms?: number } };

        if (!result.data?.audio?.url) throw new Error('No audio URL from TTS');
        return { audioUrl: result.data.audio.url, duration: (result.data.duration_ms || 5000) / 1000 };
    } catch (error) {
        console.error("TTS Generation Error:", error);
        throw error;
    }
}
