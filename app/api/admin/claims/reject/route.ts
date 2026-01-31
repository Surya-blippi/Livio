import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { claimId } = body;

        if (!claimId) {
            return NextResponse.json({ error: 'Missing claimId' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Update claim status to rejected
        const { error } = await supabaseAdmin
            .from('bonus_claims')
            .update({ status: 'rejected' })
            .eq('id', claimId);

        if (error) {
            console.error('Failed to update claim status:', error);
            return NextResponse.json({ error: 'Failed to reject claim' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error('Reject exception:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
