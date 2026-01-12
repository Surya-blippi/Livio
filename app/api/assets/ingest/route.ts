import { NextRequest, NextResponse } from 'next/server';
import { ingestAsset } from '@/lib/ingest';
import { supabaseAdmin } from '@/lib/supabase-admin';

// POST /api/assets/ingest
export async function POST(req: NextRequest) {
    try {
        // Authenticate the user checking the token
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Very basic verification using getUser from token would be better, 
        // but for now we trust the client logic to pass the token and we verify it against supabase
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const body = await req.json();
        const { url, source } = body;

        if (!url) {
            return NextResponse.json({ error: 'Missing url' }, { status: 400 });
        }

        // Logic: Check if we already have this asset? (Optional optimization for later)

        // Perform Inrest
        const result = await ingestAsset(url, user.id, source || 'api-upload');

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('Ingest API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
