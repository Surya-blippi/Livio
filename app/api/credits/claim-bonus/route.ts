import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin for potentially privileged checks
// but for insertion RLS should handle it if we use standard client.
// However, since this is a Next.js route, we might not have the user's session automatically unless we use the standard helpers.

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, postUrl } = body;

        if (!userId || !postUrl) {
            return NextResponse.json({ error: 'Missing userId or postUrl' }, { status: 400 });
        }

        // Validate URL domain
        const validDomains = ['linkedin.com', 'twitter.com', 'x.com'];
        const isValidDomain = validDomains.some(domain => postUrl.toLowerCase().includes(domain));

        if (!isValidDomain) {
            return NextResponse.json({ error: 'Invalid URL. Must be LinkedIn or Twitter/X.' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        let internalUserId = userId;
        // Resolve Clerk ID to Internal UUID
        // The frontend likely passes the Clerk ID (e.g. user_2...). We need the internal UUID.

        // Check if it looks like a Clerk ID (starts with "user_")
        if (userId.startsWith('user_')) {
            const { data: userRecord, error: userError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('clerk_id', userId)
                .single();

            if (userError || !userRecord) {
                console.error('User lookup failed:', userError);
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }
            internalUserId = userRecord.id;
        }

        // Check for existing claim first to handle re-submission
        const { data: existingClaim } = await supabaseAdmin
            .from('bonus_claims')
            .select('*')
            .eq('user_id', internalUserId)
            .single();

        let data, error;

        if (existingClaim) {
            if (existingClaim.status === 'approved') {
                return NextResponse.json({ error: 'Claim already approved', status: 'approved' }, { status: 409 });
            } else if (existingClaim.status === 'pending') {
                return NextResponse.json({ error: 'Claim under review', status: 'pending' }, { status: 409 });
            } else {
                // Rejected - allow update
                const { data: updated, error: updateError } = await supabaseAdmin
                    .from('bonus_claims')
                    .update({
                        post_url: postUrl,
                        status: 'pending'
                    })
                    .eq('id', existingClaim.id)
                    .select()
                    .single();

                data = updated;
                error = updateError;
            }
        } else {
            // New insert
            const { data: inserted, error: insertError } = await supabaseAdmin
                .from('bonus_claims')
                .insert({
                    user_id: internalUserId,
                    post_url: postUrl,
                    status: 'pending'
                })
                .select()
                .single();

            data = inserted;
            error = insertError;
        }

        if (error) {
            console.error('Claim error:', error);
            return NextResponse.json({ error: 'Failed to submit claim', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, claim: data });

    } catch (e) {
        console.error('Claim exception:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        let internalUserId = userId;
        // Resolve Clerk ID if needed
        if (userId.startsWith('user_')) {
            const { data: userRecord } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('clerk_id', userId)
                .single();

            if (userRecord) {
                internalUserId = userRecord.id;
            } else {
                // User not found in DB yet, so definitely no claim
                return NextResponse.json({ claimed: false });
            }
        }

        const { data: claim } = await supabaseAdmin
            .from('bonus_claims')
            .select('status')
            .eq('user_id', internalUserId)
            .single();

        if (claim) {
            return NextResponse.json({ claimed: true, status: claim.status });
        }

        return NextResponse.json({ claimed: false });

    } catch (e) {
        console.error('Check claim exception:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
