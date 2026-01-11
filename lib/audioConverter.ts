/**
 * Client-side audio conversion utility
 * Uses Supabase Edge Function to convert WebM to MP3
 */

import { supabase } from './supabase';

// Supabase project URL for Edge Functions
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

/**
 * Convert an audio File/Blob to MP3 format using Supabase Edge Function
 * @param audioBlob The audio file to convert (WebM, WAV, etc.)
 * @param userId Optional user ID for file naming
 * @returns Object containing the public URL of the converted MP3
 */
export async function convertToMp3ViaSupabase(
    audioBlob: Blob,
    userId?: string
): Promise<{ url: string; fileName: string }> {
    console.log('[AudioConverter] Sending to Supabase Edge Function, size:', audioBlob.size, 'type:', audioBlob.type);

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    if (userId) {
        formData.append('userId', userId);
    }

    // Get session for auth if needed
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/convert-audio`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[AudioConverter] Edge Function error:', errorData);
        throw new Error(errorData.error || `Conversion failed with status ${response.status}`);
    }

    const result = await response.json();
    console.log('[AudioConverter] Conversion successful:', result);

    return {
        url: result.url,
        fileName: result.fileName,
    };
}

/**
 * Legacy local conversion using lamejs (fallback)
 * Only used if Edge Function is unavailable
 */
export async function convertToMp3Local(audioBlob: Blob): Promise<File> {
    console.log('[AudioConverter] Using local conversion fallback');

    // Dynamic import to avoid loading lamejs unless needed
    // @ts-expect-error lamejs doesn't have types
    const lamejs = (await import('lamejs')).default;

    // Create audio context
    const audioContext = new AudioContext();

    // Decode the audio data
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get audio data (convert to mono if stereo)
    let samples: Float32Array;
    if (audioBuffer.numberOfChannels === 2) {
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        samples = new Float32Array(left.length);
        for (let i = 0; i < left.length; i++) {
            samples[i] = (left[i] + right[i]) / 2;
        }
    } else {
        samples = audioBuffer.getChannelData(0);
    }

    // Convert float samples to 16-bit integers
    const samples16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        samples16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Initialize LAME encoder
    const mp3encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128);

    // Encode in chunks
    const mp3Data: Int8Array[] = [];
    const chunkSize = 1152;

    for (let i = 0; i < samples16.length; i += chunkSize) {
        const chunk = samples16.subarray(i, i + chunkSize);
        const mp3buf = mp3encoder.encodeBuffer(chunk);
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
    }

    const mp3End = mp3encoder.flush();
    if (mp3End.length > 0) {
        mp3Data.push(mp3End);
    }

    const mp3Blob = new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mpeg' });
    const mp3File = new File([mp3Blob], 'voice_recording.mp3', { type: 'audio/mpeg' });

    await audioContext.close();
    return mp3File;
}

/**
 * Main conversion function - tries Edge Function first, falls back to local
 */
export async function convertToMp3(audioBlob: Blob, userId?: string): Promise<File> {
    try {
        // Try Supabase Edge Function first (most reliable)
        const result = await convertToMp3ViaSupabase(audioBlob, userId);

        // Create a File object from the URL for compatibility
        const response = await fetch(result.url);
        const mp3Blob = await response.blob();
        return new File([mp3Blob], result.fileName, { type: 'audio/mpeg' });
    } catch (edgeError) {
        console.warn('[AudioConverter] Edge Function failed, trying local conversion:', edgeError);

        // Fallback to local conversion
        return await convertToMp3Local(audioBlob);
    }
}

/**
 * Check if a file needs conversion (is not already MP3/WAV)
 */
export function needsConversion(file: File | Blob): boolean {
    const type = file.type.toLowerCase();
    return !type.includes('mp3') && !type.includes('mpeg') && !type.includes('wav');
}
