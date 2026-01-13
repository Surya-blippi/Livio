import { NextResponse } from 'next/server';

/**
 * Diagnostic endpoint to check environment variable status
 * Visit: https://app.reven.in/api/debug-env
 * 
 * This is a TEMPORARY endpoint - remove after debugging!
 */
export async function GET() {
    const envVars = {
        NEXT_PUBLIC_SUPABASE_URL: {
            present: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
            startsWithHttps: process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://') || false,
        },
        SUPABASE_SERVICE_ROLE_KEY: {
            present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
            startsWithEyJ: process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ') || false,
        },
        CLERK_SECRET_KEY: {
            present: !!process.env.CLERK_SECRET_KEY,
            length: process.env.CLERK_SECRET_KEY?.length || 0,
        },
        FAL_KEY: {
            present: !!process.env.FAL_KEY,
            length: process.env.FAL_KEY?.length || 0,
        },
        JSON2VIDEO_API_KEY: {
            present: !!process.env.JSON2VIDEO_API_KEY,
            length: process.env.JSON2VIDEO_API_KEY?.length || 0,
        },
        NEXT_PUBLIC_WAVESPEED_API_KEY: {
            present: !!process.env.NEXT_PUBLIC_WAVESPEED_API_KEY,
            length: process.env.NEXT_PUBLIC_WAVESPEED_API_KEY?.length || 0,
        },
    };

    // Check all required vars
    const missingVars = Object.entries(envVars)
        .filter(([_, v]) => !v.present)
        .map(([key]) => key);

    return NextResponse.json({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV || 'not-vercel',
        allRequiredPresent: missingVars.length === 0,
        missingVars,
        envVars,
    });
}
