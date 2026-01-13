/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter for API routes
 * For production at scale, consider using Upstash Redis
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory store for rate limiting (resets on serverless cold start)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW: Record<string, number> = {
    'generate-video': 5,      // 5 video generations per minute
    'generate-script': 20,    // 20 script generations per minute
    'clone-voice': 10,        // 10 voice clones per minute
    'default': 60,            // 60 requests per minute for other endpoints
};

// Get client identifier (IP or user ID)
function getClientId(request: NextRequest, userId?: string): string {
    if (userId) {
        return `user:${userId}`;
    }
    // Fall back to IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    return `ip:${ip}`;
}

// Clean up expired entries periodically
function cleanupExpiredEntries() {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetTime: number;
}

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
    request: NextRequest,
    endpoint: string,
    userId?: string
): RateLimitResult {
    const clientId = getClientId(request, userId);
    const key = `${clientId}:${endpoint}`;
    const now = Date.now();
    const limit = MAX_REQUESTS_PER_WINDOW[endpoint] || MAX_REQUESTS_PER_WINDOW['default'];

    const existing = rateLimitStore.get(key);

    if (!existing || now > existing.resetTime) {
        // Start new window
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW_MS
        });
        return {
            success: true,
            remaining: limit - 1,
            resetTime: now + RATE_LIMIT_WINDOW_MS
        };
    }

    if (existing.count >= limit) {
        // Rate limit exceeded
        return {
            success: false,
            remaining: 0,
            resetTime: existing.resetTime
        };
    }

    // Increment counter
    existing.count++;
    return {
        success: true,
        remaining: limit - existing.count,
        resetTime: existing.resetTime
    };
}

/**
 * Rate limit response helper
 */
export function rateLimitExceededResponse(result: RateLimitResult): NextResponse {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);

    return NextResponse.json(
        {
            error: 'Rate limit exceeded',
            retryAfter,
            message: `Too many requests. Please try again in ${retryAfter} seconds.`
        },
        {
            status: 429,
            headers: {
                'Retry-After': retryAfter.toString(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': result.resetTime.toString()
            }
        }
    );
}

/**
 * Wrapper to apply rate limiting to an API route handler
 */
export function withRateLimit(
    endpoint: string,
    handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
    return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
        // Extract user ID from request if available (from Clerk session)
        const userId = request.headers.get('x-user-id') || undefined;

        const result = checkRateLimit(request, endpoint, userId);

        if (!result.success) {
            console.warn(`Rate limit exceeded for ${endpoint}:`, {
                remaining: result.remaining
            });
            return rateLimitExceededResponse(result);
        }

        // Add rate limit headers to response
        const response = await handler(request, ...args);
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', result.resetTime.toString());

        return response;
    };
}
