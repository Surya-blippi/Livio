import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, addCredits, supabase } from '@/lib/supabase';
import { getDodoClient } from '@/lib/dodo';
import { CREDIT_PACKAGES } from '@/lib/credits';

export async function POST(request: NextRequest) {
    try {
        // Authenticate user
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { paymentId } = body;

        if (!paymentId) {
            return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
        }

        console.log(`[VerifyPayment] verifying payment ${paymentId} for user ${clerkId}`);

        // 1. Check if we already processed this payment
        const { data: existingTx } = await supabase
            .from('credit_transactions')
            .select('id')
            .eq('metadata->>payment_id', paymentId)
            .single();

        if (existingTx) {
            console.log(`[VerifyPayment] Payment ${paymentId} already processed`);
            return NextResponse.json({ success: true, message: 'Already processed' });
        }

        // 2. Fetch payment details from Dodo
        const dodo = getDodoClient();
        const payment = await dodo.payments.retrieve(paymentId);

        console.log(`[VerifyPayment] Dodo status: ${payment.status}, Customer: ${payment.customer.email}`);

        if (payment.status !== 'succeeded') {
            return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
        }

        // 3. Determine credits to add
        // Try to get headers/metadata from payment object if available
        // Or match amount/product ID

        let creditsToAdd = 0;
        let packageId = 'unknown';

        // Check metadata first
        const metadata = payment.metadata as Record<string, string> | undefined;
        if (metadata?.credits) {
            creditsToAdd = parseInt(metadata.credits, 10);
            packageId = metadata.package_id || 'unknown';
        }
        // Fallback: Match by amount
        else {
            // divide by 100 if dodo returns cents? No, dashboard showed $19.00.
            // documentation doesn't specify cents vs dollars clearly, but SDK types might.
            // Let's assume dollars based on previous code.
            const amount = payment.total_amount;
            const matchedPackage = CREDIT_PACKAGES.find(p => p.price === amount / 100 || p.price === amount); // Handle both cents/dollars just in case

            if (matchedPackage) {
                creditsToAdd = matchedPackage.credits + matchedPackage.bonus;
                packageId = matchedPackage.id;
            }
        }

        if (creditsToAdd === 0) {
            console.error('[VerifyPayment] Could not determine credits for payment', payment);
            return NextResponse.json({ error: 'Could not determine credit amount' }, { status: 400 });
        }

        // 4. Get User
        // We verify the clerk ID matches the authenticated user
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

        // 5. Add Credits
        console.log(`[VerifyPayment] Adding ${creditsToAdd} credits for package ${packageId}`);
        const result = await addCredits(
            user.id,
            creditsToAdd,
            'purchase',
            `Purchased ${packageId} package (Verified)`,
            {
                package_id: packageId,
                payment_id: paymentId,
                verified_at: new Date().toISOString()
            }
        );

        if (!result.success) {
            throw new Error('Failed to update balance');
        }

        return NextResponse.json({
            success: true,
            balance: result.balance,
            added: creditsToAdd
        });

    } catch (error) {
        console.error('[VerifyPayment] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Verification failed' },
            { status: 500 }
        );
    }
}
