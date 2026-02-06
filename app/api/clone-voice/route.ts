import { fal } from '@fal-ai/client';
import { cloneVoiceWithQwen } from '@/lib/fal';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

export const maxDuration = 300;

const FAL_KEY = process.env.FAL_KEY;

/**
 * Voice cloning route using Qwen (Replacing MiniMax).
 * 
 * Creates a speaker embedding from audio and saves to DB.
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

        console.log('🎤 Starting Qwen voice cloning');

        let audioBuffer: Buffer;
        let originalName = 'audio.webm';
        let audioUrlForCloning: string = '';

        // 1. Determine input source (JSON URL or FormData File)
        if (request.headers.get('content-type')?.includes('application/json')) {
            const body = await request.json();
            if (body.audioUrl) {
                audioUrlForCloning = body.audioUrl;
                // We might need to download it just to upload to Supabase backup?
                // For Qwen, we can pass the URL directly if it's public.
                // But let's assume we want to backup to 'voices' buckets.
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

        // 2. Upload to FAL storage to get a public URL for Qwen (if not already a URL)
        // Even if we have a URL, uploading to Fal ensures it's accessible to Fal services
        console.log('📤 Uploading to FAL storage...');
        const fileObj = new File([new Uint8Array(audioBuffer)], originalName, {
            type: 'audio/mpeg'
        });
        const storageUrl = await fal.storage.upload(fileObj);
        console.log('✓ Audio uploaded to:', storageUrl);
        audioUrlForCloning = storageUrl;

        // 3. Call Qwen Voice Clone
        console.log('🧬 Calling Qwen voice-clone API...');
        const { embeddingUrl, fileName, fileSize } = await cloneVoiceWithQwen(audioUrlForCloning);

        console.log('✅ Qwen voice cloned:', embeddingUrl);

        // 4. Save to DB (set as active voice)
        // Upload audio backup to Supabase
        const fileExt = originalName.split('.').pop() || 'mp3';
        const backupFileName = `${user.id}_${uuidv4()}.${fileExt}`;
        const filePath = `uploads/${backupFileName}`;

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
        }

        // Update voices table
        // We look for an existing 'pending' or active voice to update, or insert new
        // For simplicity, we'll insert a new active voice and deactivate others (handled by saveVoice usually, but here manual)

        // Deactivate others
        await supabase
            .from('voices')
            .update({ is_active: false })
            .eq('user_id', user.id);

        const customVoiceId = `v${Date.now().toString(36)}`; // Dummy ID for client compatibility

        const { data: newVoice, error: dbError } = await supabase
            .from('voices')
            .insert({
                user_id: user.id,
                voice_id: customVoiceId,
                voice_sample_url: supabaseUrl, // Backup URL
                qwen_embedding_url: embeddingUrl,
                tts_provider: 'qwen', // Still setting it for clarity in DB even if unused in code
                is_active: true,
                name: 'Cloned Voice (Qwen)'
            })
            .select()
            .single();

        if (dbError) {
            console.error('Failed to save voice to DB:', dbError);
            // Non-fatal?
        }

        return NextResponse.json({
            voiceId: customVoiceId,
            previewUrl: storageUrl, // Use audio as preview
            supabaseUrl: supabaseUrl,
            message: 'Voice cloned with Qwen.'
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
