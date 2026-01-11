/**
 * WAV Recorder Utility
 * Records audio directly as WAV format using Web Audio API
 * WAV is natively supported by MiniMax, eliminating conversion needs
 */

export class WavRecorder {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private scriptProcessor: ScriptProcessorNode | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private audioChunks: Float32Array[] = [];
    private sampleRate: number = 44100;
    private isRecording: boolean = false;

    async start(): Promise<void> {
        try {
            this.audioChunks = [];
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            });

            this.audioContext = new AudioContext({ sampleRate: 44100 });
            this.sampleRate = this.audioContext.sampleRate;

            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Use ScriptProcessorNode to capture raw audio data
            // Using 4096 buffer size for good quality
            this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

            this.scriptProcessor.onaudioprocess = (event) => {
                if (this.isRecording) {
                    const inputData = event.inputBuffer.getChannelData(0);
                    // Clone the data since the buffer gets reused
                    this.audioChunks.push(new Float32Array(inputData));
                }
            };

            this.sourceNode.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);

            this.isRecording = true;
            console.log('[WavRecorder] Recording started at', this.sampleRate, 'Hz');
        } catch (error) {
            console.error('[WavRecorder] Failed to start recording:', error);
            throw error;
        }
    }

    stop(): File {
        this.isRecording = false;

        // Disconnect nodes
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
        }
        if (this.sourceNode) {
            this.sourceNode.disconnect();
        }

        // Stop media stream
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }

        // Close audio context
        if (this.audioContext) {
            this.audioContext.close();
        }

        // Combine all chunks into a single buffer
        const totalLength = this.audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combinedBuffer = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of this.audioChunks) {
            combinedBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        // Convert to WAV
        const wavBlob = this.encodeWav(combinedBuffer, this.sampleRate);
        const wavFile = new File([wavBlob], 'recording.wav', { type: 'audio/wav' });

        console.log('[WavRecorder] Recording stopped, file size:', wavFile.size, 'bytes');

        return wavFile;
    }

    private encodeWav(samples: Float32Array, sampleRate: number): Blob {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        // WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        this.writeString(view, 8, 'WAVE');

        // fmt chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size
        view.setUint16(20, 1, true); // AudioFormat (PCM)
        view.setUint16(22, 1, true); // NumChannels (Mono)
        view.setUint32(24, sampleRate, true); // SampleRate
        view.setUint32(28, sampleRate * 2, true); // ByteRate
        view.setUint16(32, 2, true); // BlockAlign
        view.setUint16(34, 16, true); // BitsPerSample

        // data chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);

        // Convert float samples to 16-bit PCM
        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
            view.setInt16(offset, val, true);
            offset += 2;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    private writeString(view: DataView, offset: number, str: string): void {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    getIsRecording(): boolean {
        return this.isRecording;
    }
}

// Singleton instance for easy use
let recorderInstance: WavRecorder | null = null;

export function getWavRecorder(): WavRecorder {
    if (!recorderInstance) {
        recorderInstance = new WavRecorder();
    }
    return recorderInstance;
}
