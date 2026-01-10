/**
 * Client-side audio conversion utility
 * Converts WebM/audio blob to MP3 using lamejs
 */

// @ts-expect-error lamejs doesn't have types
import lamejs from 'lamejs';

/**
 * Convert an audio File/Blob to MP3 format
 * @param audioBlob The audio file to convert (WebM, WAV, etc.)
 * @returns A new File object in MP3 format
 */
export async function convertToMp3(audioBlob: Blob): Promise<File> {
    console.log('[AudioConverter] Starting conversion, input size:', audioBlob.size, 'type:', audioBlob.type);

    // Create audio context
    const audioContext = new AudioContext();

    // Decode the audio data
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    console.log('[AudioConverter] Decoded audio - channels:', audioBuffer.numberOfChannels,
        'sampleRate:', audioBuffer.sampleRate,
        'duration:', audioBuffer.duration);

    // Get audio data (convert to mono if stereo)
    let samples: Float32Array;
    if (audioBuffer.numberOfChannels === 2) {
        // Mix stereo to mono
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
    const sampleCount = samples.length;
    const samples16 = new Int16Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        samples16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Initialize LAME encoder
    const mp3encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128); // Mono, 128kbps

    // Encode in chunks
    const mp3Data: Int8Array[] = [];
    const chunkSize = 1152; // LAME requires samples in multiples of 1152

    for (let i = 0; i < samples16.length; i += chunkSize) {
        const chunk = samples16.subarray(i, i + chunkSize);
        const mp3buf = mp3encoder.encodeBuffer(chunk);
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
    }

    // Flush remaining data
    const mp3End = mp3encoder.flush();
    if (mp3End.length > 0) {
        mp3Data.push(mp3End);
    }

    // Combine all chunks into a single Blob
    // Convert Int8Array to Uint8Array for Blob compatibility
    const mp3Uint8Arrays = mp3Data.map(arr => new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
    const mp3Blob = new Blob(mp3Uint8Arrays, { type: 'audio/mpeg' });
    const mp3File = new File([mp3Blob], 'voice_recording.mp3', { type: 'audio/mpeg' });


    console.log('[AudioConverter] Conversion complete, output size:', mp3File.size);

    // Close audio context
    await audioContext.close();

    return mp3File;
}

/**
 * Check if a file needs conversion (is not already MP3/WAV)
 */
export function needsConversion(file: File | Blob): boolean {
    const type = file.type.toLowerCase();
    return !type.includes('mp3') && !type.includes('mpeg') && !type.includes('wav');
}
