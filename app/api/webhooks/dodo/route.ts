import { NextRequest, NextResponse } from 'next/server';
import { addCredits } from '@/lib/supabase';

// Webhook handler for DodoPayments events
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        console.log('[DodoWebhook] Received event:', body.type || 'unknown');

        // Handle payment success event
        // DodoPayments sends various event types - we care about successful payments
        const eventType = body.type || body.event_type;

        if (eventType === 'payment.succeeded' || eventType === 'payment_intent.succeeded' || eventType === 'checkout.completed') {
            const metadata = body.data?.metadata || body.metadata || {};
            const userId = metadata.user_id;
            const packageId = metadata.package_id;
            const credits = parseInt(metadata.credits, 10);

            if (!userId || !credits || isNaN(credits)) {
                console.error('[DodoWebhook] Missing required metadata:', { userId, packageId, credits });
                return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
            }

            console.log(`[DodoWebhook] Adding ${credits} credits to user ${userId} for package ${packageId}`);

            // Add credits to user account
            const result = await addCredits(
                userId,
                credits,
                'purchase',
                `Purchased ${packageId} package`,
                {
                    package_id: packageId,
                    payment_id: body.data?.payment_id || body.id,
                    event_type: eventType
                }
            );

            if (!result.success) {
                console.error('[DodoWebhook] Failed to add credits');
                return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
            }

            console.log(`[DodoWebhook] Successfully added credits. New balance: ${result.balance}`);

            return NextResponse.json({ success: true, balance: result.balance });
        }

        // Acknowledge other events without processing
        console.log('[DodoWebhook] Ignoring event type:', eventType);
        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('[DodoWebhook] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Webhook processing failed' },
            { status: 500 }
        );
    }
}

// DodoPayments may send GET requests for verification
export async function GET() {
    return NextResponse.json({ status: 'ok', message: 'DodoPayments webhook endpoint' });
}
