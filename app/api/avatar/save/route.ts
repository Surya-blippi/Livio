import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Save avatar to database - uses admin client to bypass RLS
 */
export async function POST(request: NextRequest) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

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

        const { imageUrl, name, isDefault } = await request.json();

        if (!imageUrl) {
            return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // Check if avatar with same image_url already exists
        const { data: existing } = await supabaseAdmin
            .from('avatars')
            .select('*')
            .eq('user_id', user.id)
            .eq('image_url', imageUrl)
            .single();

        if (existing) {
            // Avatar already exists - update is_default if needed
            if (isDefault && !existing.is_default) {
                // Unset other defaults first
                await supabaseAdmin
                    .from('avatars')
                    .update({ is_default: false })
                    .eq('user_id', user.id);

                // Set this one as default
                const { data: updated, error } = await supabaseAdmin
                    .from('avatars')
                    .update({ is_default: true })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) {
                    console.error('Error updating avatar:', error);
                    return NextResponse.json({ savedAvatar: existing });
                }
                return NextResponse.json({ savedAvatar: updated });
            }
            return NextResponse.json({ savedAvatar: existing });
        }

        // If setting as default, unset others first
        if (isDefault) {
            await supabaseAdmin
                .from('avatars')
                .update({ is_default: false })
                .eq('user_id', user.id);
        }

        // Insert new avatar
        const { data: savedAvatar, error } = await supabaseAdmin
            .from('avatars')
            .insert({
                user_id: user.id,
                image_url: imageUrl,
                name: name || 'Avatar',
                is_default: isDefault ?? false,
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving avatar:', error);
            return NextResponse.json({ error: 'Failed to save avatar' }, { status: 500 });
        }

        return NextResponse.json({ savedAvatar });

    } catch (error: unknown) {
        console.error('Avatar save error:', error);
        const message = error instanceof Error ? error.message : 'Failed to save avatar';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
