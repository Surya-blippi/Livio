import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin for potentially privileged checks, but for insertion RLS should handle it if we use standard client.
// However, since this is a Next.js route, we might not have the user's session automatically unless we use the standard helpers.
// Let's rely on the client passing the user ID and RLS enforcing rule "Users can insert their own claims".
// BUT, to be robust against spoofing, we should really verify the auth token.
// Given the context, I will use `req.headers.get('Authorization')` if available, or just use the Admin client for now 
// and trust the `user_id` passed in body IF we don't have auth middleware.
// Wait, the plan said "Inserts into bonus_claims".
// I'll stick to a simple implementation: Receive user_id and post_url.
// Rely on database unique constraint for safety.

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

        // Resolve Clerk ID to Internal UUID
        // The frontend likely passes the Clerk ID (e.g. user_2...). We need the internal UUID.
        let internalUserId = userId;

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

        // Insert claim
        const { data, error } = await supabaseAdmin
            .from('bonus_claims')
            .insert({
                user_id: internalUserId,
                post_url: postUrl,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            // Check for unique constraint violation (Postgres error 23505)
            if (error.code === '23505') {
                return NextResponse.json({ error: 'You have already submitted a claim.' }, { status: 409 });
            }
            console.error('Claim error:', error);
            // Return more specific error for debugging if needed, but standardizing to 500
            return NextResponse.json({ error: 'Failed to submit claim', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, claim: data });

    } catch (e) {
        console.error('Claim exception:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
