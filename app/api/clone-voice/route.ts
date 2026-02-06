import { fal } from '@fal-ai/client';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || process.env.NEXT_PUBLIC_WAVESPEED_API_KEY;

/**
 * Voice cloning route using WaveSpeed MiniMax.
 * 
 * One-time voice clone creates a reusable minimax_voice_id.
 * This ID is saved to DB and used for all future TTS calls.
 */
export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Get user
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

        console.log('🎤 Starting MiniMax voice cloning via WaveSpeed');

        let audioBuffer: Buffer;
        let originalName = 'audio.webm';

        // 1. Determine input source (JSON URL or FormData File)
        if (request.headers.get('content-type')?.includes('application/json')) {
            const body = await request.json();
            if (body.audioUrl) {
                // Download the audio from the URL
                const audioResponse = await fetch(body.audioUrl);
                audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
                originalName = 'audio.mp3';
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

        // 2. Upload to FAL storage to get a public URL for WaveSpeed
        console.log('📤 Uploading to FAL storage...');
        const fileObj = new File([new Uint8Array(audioBuffer)], originalName, {
            type: 'audio/mpeg'
        });
        const storageUrl = await fal.storage.upload(fileObj);
        console.log('✓ Audio uploaded to:', storageUrl);

        // 3. Generate unique custom_voice_id for MiniMax
        // Format: Must be 8+ chars, alphanumeric, start with letter
        const customVoiceId = `v${user.id.replace(/-/g, '').substring(0, 12)}${Date.now().toString(36)}`;
        console.log('🔑 Generated custom_voice_id:', customVoiceId);

        // 4. Call WaveSpeed MiniMax voice clone API
        console.log('🧬 Calling WaveSpeed MiniMax voice-clone API...');
        const cloneResponse = await fetch('https://api.wavespeed.ai/api/v3/minimax/voice-clone', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audio: storageUrl,
                custom_voice_id: customVoiceId,
                model: 'speech-02-hd',
                need_noise_reduction: true,
                language_boost: 'auto',
                text: 'Hello! This is a preview of your cloned voice.'
            })
        });

        if (!cloneResponse.ok) {
            const errorData = await cloneResponse.json();
            console.error('MiniMax clone error:', errorData);
            throw new Error(`Voice cloning failed: ${JSON.stringify(errorData)}`);
        }

        const cloneResult = await cloneResponse.json();
        console.log('✓ MiniMax voice clone result:', cloneResult);

        // 5. Also upload to Supabase for long-term storage backup
        const fileExt = originalName.split('.').pop() || 'mp3';
        const fileName = `${user.id}_${uuidv4()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('voices')
            .upload(filePath, audioBuffer, {
                contentType: 'audio/mpeg',
                upsert: false
            });

        let supabaseUrl = storageUrl;
        if (!uploadError) {
            const { data } = supabase.storage.from('voices').getPublicUrl(filePath);
            supabaseUrl = data.publicUrl;
            console.log('✓ Also uploaded to Supabase:', supabaseUrl);
        }

        console.log('✅ Voice cloned successfully with MiniMax! Voice ID:', customVoiceId);

        return NextResponse.json({
            voiceId: customVoiceId,  // MiniMax custom_voice_id
            minimaxVoiceId: customVoiceId,  // Explicit field
            voiceSampleUrl: storageUrl,
            supabaseUrl: supabaseUrl,
            previewUrl: cloneResult.outputs?.[0] || storageUrl,
            message: 'Voice cloned with MiniMax. Ready for TTS!'
        });

    } catch (error: unknown) {
        console.error('Error cloning voice:', error);

        let errorMessage = 'Failed to clone voice';

        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            {
                error: errorMessage,
                hint: 'Voice cloning requires a valid audio file.'
            },
            { status: 500 }
        );
    }
}
