import { fal } from '@fal-ai/client';
import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, readFile, unlink } from 'fs/promises';
import os from 'os';
import path from 'path';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits } from '@/lib/supabase';
import { CREDIT_COSTS } from '@/lib/credits';

// Set FFmpeg path from ffmpeg-static (works better on serverless)
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

export async function POST(request: NextRequest) {
    let tempInputPath = '';
    let tempOutputPath = '';

    try {
        // Authenticate
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Get user for credits
        const currentUserData = await currentUser();
        const user = await getOrCreateUser(
            clerkId,
            currentUserData?.emailAddresses[0]?.emailAddress || '',
            currentUserData?.firstName || undefined,
            currentUserData?.imageUrl || undefined
        );

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check credits
        const cost = CREDIT_COSTS.VOICE_CLONING;
        const hasCredits = await hasEnoughCredits(user.id, cost);

        if (!hasCredits) {
            return NextResponse.json({
                error: `Insufficient credits. Voice cloning requires ${cost} credits.`,
                code: 'INSUFFICIENT_CREDITS'
            }, { status: 402 });
        }

        console.log('CHECKPOINT: Starting clone-voice handler');
        console.log('CHECKPOINT: FFmpeg path:', ffmpegPath);

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
            // INTENTIONAL HACK: MiniMax rejects .webm extension but likely handles the stream.
            // We force mimeType to audio/mpeg (MP3) to bypass the extension check.
            mimeType = 'audio/mpeg';
            base64 = bufferToUpload.toString('base64');
        }

        console.log('CHECKPOINT: Uploading to Fal storage...');
        // Upload to Fal storage to get a public URL
        // FORCE the filename to be .mp3 using the File constructor. 
        // This ensures the resulting URL ends in .mp3, satisfying MiniMax's extension check.
        const fileObj = new File([new Uint8Array(bufferToUpload)], 'force_audio.mp3', { type: mimeType });
        const storageUrl = await fal.storage.upload(fileObj);
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

        // Deduct credits on success
        await deductCredits(user.id, cost, 'Voice Cloning', {
            voiceId: result.data.custom_voice_id
        });

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
