import { NextRequest, NextResponse } from 'next/server';
import { supabase, createAuthenticatedClient } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
    try {
        const { userId, getToken } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { fileName, fileType } = body;

        // Generate a unique path
        // Use 'temp' folder in 'videos' bucket
        const uniquePath = `temp/${userId}/${Date.now()}_${fileName}`;

        // Get authenticated client (though signed URL generation usually works with Service Role or admin)
        // Actually, createSignedUploadUrl works if we have permission.
        // We'll use the authenticated client to ensure RLS is respected if applicable,
        // OR use the Service Role if needed.
        // But for generating a signed URL for *the user* to upload, we act as the server.
        // Let's use the default supabase client if it has permissions, or Auth client.

        // For 'createSignedUploadUrl', we are delegating permission.
        // We need to use a client that HAS permission to write to that path?
        // No, we are GIVING permission.
        // So we likely need the Service Role Key or an Admin client?
        // Or if the Bucket is Public?

        // Let's try with the authenticated client (user's permissions).
        const token = await getToken({ template: 'supabase' });
        const client = token ? createAuthenticatedClient(token) : supabase;

        // Note: Client-side uploadToSignedUrl requires the token generated here.
        const { data, error } = await client
            .storage
            .from('videos')
            .createSignedUploadUrl(uniquePath);

        if (error) {
            console.error('Error creating signed upload URL:', error);
            // Fallback: If RLS blocks creation, maybe we need Service Role?
            // But usually users can upload to their own folders.
            throw error;
        }

        // data contains: { signedUrl, token, path }
        // Wait, createSignedUploadUrl returns { signedUrl, path, token, ... }

        return NextResponse.json({
            signedUrl: data.signedUrl,
            token: data.token,
            path: data.path,
            publicUrl: supabase.storage.from('videos').getPublicUrl(uniquePath).data.publicUrl
        });

    } catch (error) {
        console.error('Upload sign error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
