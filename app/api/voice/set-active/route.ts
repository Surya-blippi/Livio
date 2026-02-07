import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Set active voice - uses admin client to bypass RLS
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

        const { voiceId } = await request.json();

        if (!voiceId) {
            return NextResponse.json({ error: 'voiceId is required' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // Deactivate all other voices for this user
        await supabaseAdmin
            .from('voices')
            .update({ is_active: false })
            .eq('user_id', user.id);

        // Activate the selected voice
        const { data: updatedVoice, error } = await supabaseAdmin
            .from('voices')
            .update({ is_active: true })
            .eq('id', voiceId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) {
            console.error('Error setting active voice:', error);
            return NextResponse.json({ error: 'Failed to set active voice' }, { status: 500 });
        }

        return NextResponse.json({ voice: updatedVoice });

    } catch (error: unknown) {
        console.error('Voice set-active error:', error);
        const message = error instanceof Error ? error.message : 'Failed to set active voice';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
