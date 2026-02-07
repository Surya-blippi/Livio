import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60;

/**
 * Avatar upload route - handles storage upload and DB save
 * Uses admin client to bypass RLS restrictions
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

        const supabaseAdmin = getSupabaseAdmin();

        // Handle FormData (file upload) or JSON (URL)
        let imageBuffer: Buffer;
        let fileName: string;
        let contentType: string = 'image/png';

        if (request.headers.get('content-type')?.includes('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('file') as File;

            if (!file) {
                return NextResponse.json({ error: 'File is required' }, { status: 400 });
            }

            imageBuffer = Buffer.from(await file.arrayBuffer());
            const ext = file.name.split('.').pop() || 'png';
            fileName = `${user.id}/${Date.now()}.${ext}`;
            contentType = file.type || 'image/png';
        } else {
            const body = await request.json();
            if (!body.imageUrl) {
                return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
            }

            // Download image from URL
            const imageResponse = await fetch(body.imageUrl);
            imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            fileName = `${user.id}/${Date.now()}.png`;
            contentType = imageResponse.headers.get('content-type') || 'image/png';
        }

        // Upload to storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from('avatars')
            .upload(fileName, imageBuffer, {
                contentType,
                upsert: false
            });

        if (uploadError) {
            console.error('Avatar upload error:', uploadError);
            return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
        }

        const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        // Save to avatars table
        const { data: savedAvatar, error: dbError } = await supabaseAdmin
            .from('avatars')
            .insert({
                user_id: user.id,
                image_url: publicUrl,
                name: 'Avatar',
                is_default: false
            })
            .select()
            .single();

        if (dbError) {
            console.error('Avatar DB save error:', dbError);
            // Still return the URL even if DB save fails
        }

        return NextResponse.json({
            success: true,
            url: publicUrl,
            savedAvatar: savedAvatar || null
        });

    } catch (error: unknown) {
        console.error('Avatar upload error:', error);
        const message = error instanceof Error ? error.message : 'Failed to upload avatar';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
