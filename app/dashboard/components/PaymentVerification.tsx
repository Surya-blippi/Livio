'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { showToast } from '@/lib/toast';

export function PaymentVerification() {
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const checkPayment = async () => {
            const purchase = searchParams.get('purchase');
            const paymentId = searchParams.get('payment_id');

            if (purchase === 'success' && paymentId) {
                try {
                    // Manually verify payment to ensure credits are added
                    // This acts as a fallback if webhook failed
                    const res = await fetch('/api/verify-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paymentId })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (data.added) {
                            showToast({
                                type: 'success',
                                message: `Added ${data.added} credits to your account.`,
                            });
                            // Trigger credit refresh
                            window.dispatchEvent(new Event('credits-updated'));
                        }
                    }
                } catch (error) {
                    console.error('Error verifying payment:', error);
                    showToast({
                        type: 'error',
                        message: 'Could not verify payment. Refresh and try again.',
                    });
                } finally {
                    // Clean URL
                    router.replace('/dashboard');
                }
            }
        };

        checkPayment();
    }, [searchParams, router]);

    return null; // This component renders nothing
}
