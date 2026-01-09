import { NextRequest, NextResponse } from 'next/server';
import {
    convertToJson2VideoFormat,
    startRender,
    getRenderStatus,
    generateSRT,
    type RenderInput,
    type CaptionWord,
} from '@/lib/json2video';

/**
 * POST /api/render-json2video
 * 
 * Start a video render using JSON2Video API.
 * 
 * Request body:
 * - scenes: Array of { imageUrl, audioUrl, duration, text }
 * - wordTimings: Array of { word, start, end }
 * - enableCaptions: boolean
 * - captionStyle: string (optional)
 * - enableBackgroundMusic: boolean (optional)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            scenes = [],
            wordTimings = [],
            enableCaptions = true,
            captionStyle = 'bold-classic',
            enableBackgroundMusic = false,
            audioUrl,
            backgroundMusicUrl,
        } = body as {
            scenes: { imageUrl: string; audioUrl: string; duration: number; text: string }[];
            wordTimings: CaptionWord[];
            enableCaptions: boolean;
            captionStyle?: string;
            enableBackgroundMusic?: boolean;
            audioUrl?: string;
            backgroundMusicUrl?: string;
        };

        if (!scenes || scenes.length === 0) {
            return NextResponse.json(
                { error: 'At least one scene is required' },
                { status: 400 }
            );
        }

        console.log(`[JSON2Video] Starting render with ${scenes.length} scenes`);
        console.log(`[JSON2Video] Captions: ${enableCaptions}, Style: ${captionStyle}`);
        console.log(`[JSON2Video] Audio URL: ${audioUrl ? 'provided' : 'none'}`);

        // Convert to JSON2Video format
        const renderInput: RenderInput = {
            scenes: scenes.map(s => ({
                imageUrl: s.imageUrl,
                audioUrl: s.audioUrl,
                duration: s.duration,
                text: s.text,
            })),
            wordTimings,
            enableCaptions,
            captionStyle,
            enableBackgroundMusic,
            audioUrl,
            backgroundMusicUrl,
        };

        const movie = convertToJson2VideoFormat(renderInput);

        console.log('[JSON2Video] Movie payload:', JSON.stringify(movie, null, 2));

        // Start the render
        const response = await startRender(movie);

        if (!response.success || !response.project) {
            console.error('[JSON2Video] Start render failed:', response);
            return NextResponse.json(
                { error: response.message || 'Failed to start render' },
                { status: 500 }
            );
        }

        console.log(`[JSON2Video] Render started, project ID: ${response.project}`);

        return NextResponse.json({
            success: true,
            projectId: response.project,
            message: 'Render started',
            remainingQuota: response.remaining_quota,
        });

    } catch (error) {
        console.error('[JSON2Video] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/render-json2video?projectId=xxx
 * 
 * Poll for render status.
 * 
 * Returns:
 * - status: 'waiting' | 'rendering' | 'done' | 'error'
 * - progress: number (0-100)
 * - videoUrl: string (when done)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json(
                { error: 'projectId is required' },
                { status: 400 }
            );
        }

        console.log(`[JSON2Video] Checking status for project: ${projectId}`);

        const status = await getRenderStatus(projectId);

        console.log(`[JSON2Video] Status: ${status.status}, Progress: ${status.progress}%`);

        return NextResponse.json({
            success: status.success,
            status: status.status,
            progress: status.progress || 0,
            videoUrl: status.videoUrl || null,
            message: status.message,
        });

    } catch (error) {
        console.error('[JSON2Video] Status error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
