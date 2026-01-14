import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser } from '@/lib/supabase';
import { getDodoClient, DODO_PRODUCT_IDS } from '@/lib/dodo';
import { CREDIT_PACKAGES } from '@/lib/credits';

export async function POST(request: NextRequest) {
    try {
        // Authenticate user
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { packageId } = body;

        if (!packageId) {
            return NextResponse.json({ error: 'Package ID is required' }, { status: 400 });
        }

        // Validate package exists
        const selectedPackage = CREDIT_PACKAGES.find(p => p.id === packageId);
        if (!selectedPackage) {
            return NextResponse.json({ error: 'Invalid package' }, { status: 400 });
        }

        // Get product ID for DodoPayments
        const productId = DODO_PRODUCT_IDS[packageId];
        if (!productId) {
            return NextResponse.json({ error: 'Product not configured' }, { status: 500 });
        }

        // Get user data for metadata
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

        // Create checkout session
        // Default to app.reven.in if env var is not set, or use provided env var
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.reven.in';
        const dodo = getDodoClient();

        const checkoutResponse = await dodo.checkoutSessions.create({
            product_cart: [
                {
                    product_id: productId,
                    quantity: 1
                }
            ],
            return_url: `${appUrl}/dashboard?purchase=success&package=${packageId}`,
            metadata: {
                user_id: user.id,
                clerk_id: clerkId,
                package_id: packageId,
                credits: String(selectedPackage.credits + selectedPackage.bonus),
            }
        });

        console.log('[Checkout] Session created:', checkoutResponse.session_id);

        return NextResponse.json({
            checkoutUrl: checkoutResponse.checkout_url,
            sessionId: checkoutResponse.session_id
        });

    } catch (error) {
        console.error('[Checkout] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create checkout' },
            { status: 500 }
        );
    }
}
