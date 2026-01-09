import { fal } from '@fal-ai/client';
import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, readFile, unlink } from 'fs/promises';
import os from 'os';
import path from 'path';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function POST(request: NextRequest) {
    let tempInputPath = '';
    let tempOutputPath = '';

    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            return NextResponse.json(
                { error: 'Audio file is required' },
                { status: 400 }
            );
        }

        console.log('Processing audio upload:', audioFile.name, audioFile.type, audioFile.size);

        // Setup temp paths
        const tempId = uuidv4();
        const tempDir = os.tmpdir();
        // Determine input extension or default to webm (common for recorder blobs)
        const inputExt = audioFile.name.split('.').pop() || 'webm';
        tempInputPath = path.join(tempDir, `${tempId}.${inputExt}`);
        tempOutputPath = path.join(tempDir, `${tempId}.mp3`);

        // Write uploaded file to temp
        const buffer = Buffer.from(await audioFile.arrayBuffer());
        await writeFile(tempInputPath, buffer);

        console.log(`Converting ${tempInputPath} to ${tempOutputPath}...`);

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
        const base64 = convertedBuffer.toString('base64');
        const audioUrl = `data:audio/mp3;base64,${base64}`;

        console.log('Conversion successful. New size:', convertedBuffer.length);

        // Call MiniMax voice cloning API with the converted MP3
        const result = await fal.subscribe('fal-ai/minimax/voice-clone', {
            input: {
                audio_url: audioUrl,
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

        console.log('Voice cloning result:', result);

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
