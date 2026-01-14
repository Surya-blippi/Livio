import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, getUserCredits } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const { userId: clerkId } = await auth();

        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Get clerk user data
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get or create db user
        const dbUser = await getOrCreateUser(
            clerkId,
            user.emailAddresses[0]?.emailAddress || '',
            user.firstName || undefined,
            user.imageUrl || undefined
        );

        if (!dbUser) {
            return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
        }

        // Get credits
        const credits = await getUserCredits(dbUser.id);

        if (!credits) {
            return NextResponse.json({ error: 'Failed to get credits' }, { status: 500 });
        }

        return NextResponse.json({
            balance: credits.balance,
            lifetime_purchased: credits.lifetime_purchased,
            lifetime_used: credits.lifetime_used
        });
    } catch (error) {
        console.error('[Credits API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
