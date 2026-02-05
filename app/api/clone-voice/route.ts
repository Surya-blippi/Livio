import { fal } from '@fal-ai/client';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

/**
 * Voice "cloning" route - With Chatterbox, we don't need to call an external API.
 * We simply upload the voice sample to storage and return the URL.
 * The actual zero-shot cloning happens during TTS generation.
 * 
 * This route is now FREE (no credits charged).
 */
export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Get user (for userId)
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

        console.log('CHECKPOINT: Starting voice upload (Chatterbox mode - no clone API call)');

        let audioBuffer: Buffer;
        let originalName = 'audio.webm';

        // 1. Determine input source (JSON URL or FormData File)
        if (request.headers.get('content-type')?.includes('application/json')) {
            const body = await request.json();
            if (body.audioUrl) {
                console.log('Using provided audio URL:', body.audioUrl);
                // If URL is already hosted, we can use it directly
                // Just return the URL as-is (no need to re-upload)
                return NextResponse.json({
                    voiceId: null, // Not used with Chatterbox
                    voiceSampleUrl: body.audioUrl,
                    previewUrl: body.audioUrl,
                    message: 'Voice sample ready for Chatterbox TTS'
                });
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

        // 2. Upload to FAL storage to get a public URL
        // FAL storage URLs are accessible by other FAL services including Chatterbox
        console.log('CHECKPOINT: Uploading to Fal storage...');
        const fileObj = new File([new Uint8Array(audioBuffer)], originalName, {
            type: 'audio/mpeg'
        });
        const storageUrl = await fal.storage.upload(fileObj);
        console.log('CHECKPOINT: Audio uploaded to:', storageUrl);

        // 3. Also upload to Supabase for long-term storage backup
        const fileExt = originalName.split('.').pop() || 'mp3';
        const fileName = `${user.id}_${uuidv4()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('voices')
            .upload(filePath, audioBuffer, {
                contentType: 'audio/mpeg',
                upsert: false
            });

        let supabaseUrl = storageUrl; // Fallback to FAL URL
        if (!uploadError) {
            const { data } = supabase.storage.from('voices').getPublicUrl(filePath);
            supabaseUrl = data.publicUrl;
            console.log('CHECKPOINT: Also uploaded to Supabase:', supabaseUrl);
        } else {
            console.warn('Supabase upload failed, using FAL URL:', uploadError);
        }

        // Note: No credits charged! Chatterbox does zero-shot cloning for free.
        console.log('✅ Voice sample uploaded successfully. No credits charged (Chatterbox mode).');

        return NextResponse.json({
            voiceId: null, // Deprecated - not used with Chatterbox
            voiceSampleUrl: storageUrl, // Primary URL for Chatterbox TTS
            supabaseUrl: supabaseUrl, // Backup/long-term storage
            previewUrl: storageUrl,
            message: 'Voice sample uploaded. Zero-shot cloning will happen during TTS.'
        });

    } catch (error: unknown) {
        console.error('Error uploading voice:', error);

        let errorMessage = 'Failed to upload voice';

        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            {
                error: errorMessage,
                hint: 'Voice upload requires a valid audio file.'
            },
            { status: 500 }
        );
    }
}
