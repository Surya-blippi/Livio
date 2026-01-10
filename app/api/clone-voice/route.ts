import { fal } from '@fal-ai/client';
import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
// import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'; // Dynamic import used instead
import { v4 as uuidv4 } from 'uuid';
import { writeFile, readFile, unlink } from 'fs/promises';
import os from 'os';
import path from 'path';

// Don't set path at top level to avoid build-time errors with platform binaries
// ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function POST(request: NextRequest) {
    let tempInputPath = '';
    let tempOutputPath = '';

    try {
        // Initialize ffmpeg path inside handler using dynamic require to avoid build-time resolution
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
            const ffmpegPath = ffmpegInstaller.path;
            if (ffmpegPath) {
                ffmpeg.setFfmpegPath(ffmpegPath);
            } else {
                console.warn('FFmpeg path not found in installer, using default system path');
            }
        } catch (e) {
            console.warn('Failed to set ffmpeg path from installer:', e);
            // Continue, hoping ffmpeg is in global path or conversion isn't strictly fatal
        }

        let audioBuffer: Buffer;
        let originalName = 'audio.webm';

        // 1. Determine input source (JSON URL or FormData File)
        if (request.headers.get('content-type')?.includes('application/json')) {
            const body = await request.json();
            if (body.audioUrl) {
                console.log('Using provided audio URL for cloning:', body.audioUrl);
                // Download the file from the URL
                const response = await fetch(body.audioUrl);
                if (!response.ok) throw new Error(`Failed to download audio from URL: ${response.statusText}`);
                const arrayBuffer = await response.arrayBuffer();
                audioBuffer = Buffer.from(arrayBuffer);

                // Try to infer extension from URL
                const urlPath = new URL(body.audioUrl).pathname;
                const ext = path.extname(urlPath);
                if (ext) originalName = `audio${ext}`;
            } else {
                return NextResponse.json({ error: 'audioUrl is required in JSON body' }, { status: 400 });
            }
        } else {
            const formData = await request.formData();
            const audioFile = formData.get('audio') as File;

            if (!audioFile) {
                return NextResponse.json({ error: 'Audio file or audioUrl is required' }, { status: 400 });
            }
            console.log('Processing audio upload:', audioFile.name, audioFile.type, audioFile.size);
            audioBuffer = Buffer.from(await audioFile.arrayBuffer());
            originalName = audioFile.name;
        }

        // Setup temp paths
        const tempId = uuidv4();
        const tempDir = os.tmpdir();
        // Determine input extension or default to webm (common for recorder blobs)
        const inputExt = originalName.split('.').pop() || 'webm';
        tempInputPath = path.join(tempDir, `${tempId}.${inputExt}`);
        tempOutputPath = path.join(tempDir, `${tempId}.mp3`);

        // Write buffer to temp
        await writeFile(tempInputPath, audioBuffer);
        console.log(`Saved input to ${tempInputPath}, attempting conversion to MP3...`);

        let bufferToUpload = audioBuffer;
        let mimeType = 'audio/mpeg'; // Default to claiming MP3 if converted, or risk it if fallback
        let base64 = '';

        try {
            // Convert to MP3
            await new Promise<void>((resolve, reject) => {
                ffmpeg(tempInputPath)
                    .toFormat('mp3')
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .save(tempOutputPath);
            });

            // Read converted file
            const convertedBuffer = await readFile(tempOutputPath);
            bufferToUpload = convertedBuffer;
            base64 = convertedBuffer.toString('base64');
            console.log('Conversion successful. New size:', convertedBuffer.length);
        } catch (ffmpegError) {
            console.warn('FFmpeg conversion failed, falling back to original file:', ffmpegError);
            // Fallback: Use original buffer. 
            mimeType = inputExt === 'mp3' ? 'audio/mpeg' : `audio/${inputExt}`;
            base64 = bufferToUpload.toString('base64');
        }

        console.log('CHECKPOINT: Uploading to Fal storage...');
        // Upload to Fal storage to get a public URL
        // Cast buffer to Uint8Array to satisfy Blob TS definition
        const blob = new Blob([new Uint8Array(bufferToUpload)], { type: mimeType });
        const storageUrl = await fal.storage.upload(blob);
        console.log('CHECKPOINT: Audio uploaded to:', storageUrl);

        // Call MiniMax voice cloning API with the converted MP3 URL
        console.log('CHECKPOINT: Calling Fal Subscribe...');
        const result = await fal.subscribe('fal-ai/minimax/voice-clone', {
            input: {
                audio_url: storageUrl,
                model: 'speech-02-hd',
                noise_reduction: true,
                need_volume_normalization: true
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS') {
                    console.log('Voice cloning progress:', update.logs?.map((log: { message: string }) => log.message));
                }
            }
        });

        console.log('CHECKPOINT: Voice cloning result received:', result);

        return NextResponse.json({
            voiceId: result.data.custom_voice_id,
            previewUrl: result.data.audio?.url,
            audioBase64: base64 // Return the MP3 base64
        });

    } catch (error: unknown) {
        console.error('Error cloning/converting voice:', error);

        let errorMessage = 'Failed to clone voice';
        let errorDetails = null;

        if (error instanceof Error) {
            errorMessage = error.message;
            if ('body' in error) {
                errorDetails = (error as { body?: unknown }).body;
                console.error('Fal AI Error Body:', JSON.stringify(errorDetails, null, 2));
            }
        }

        return NextResponse.json(
            {
                error: errorMessage,
                details: errorDetails,
                hint: 'Voice cloning requires a clear audio sample.'
            },
            { status: 500 }
        );
    } finally {
        // Cleanup temp files
        try {
            if (tempInputPath) await unlink(tempInputPath).catch(() => { });
            if (tempOutputPath) await unlink(tempOutputPath).catch(() => { });
        } catch (e) {
            console.error('Error cleaning up temp files:', e);
        }
    }
}
