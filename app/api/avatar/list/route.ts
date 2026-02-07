import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * List user's avatars - uses admin client to bypass RLS
 */
export async function GET(request: NextRequest) {
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

        const supabaseAdmin = getSupabaseAdmin();

        const { data: avatars, error } = await supabaseAdmin
            .from('avatars')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching avatars:', error);
            return NextResponse.json({ error: 'Failed to fetch avatars' }, { status: 500 });
        }

        return NextResponse.json({ avatars: avatars || [] });

    } catch (error: unknown) {
        console.error('Avatar list error:', error);
        const message = error instanceof Error ? error.message : 'Failed to list avatars';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
