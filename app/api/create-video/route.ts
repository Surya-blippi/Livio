import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';

const WAVESPEED_API_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk';
const WAVESPEED_API_KEY = process.env.NEXT_PUBLIC_WAVESPEED_API_KEY!;

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const imageFile = formData.get('image') as File | null;
        const imageUrl = formData.get('imageUrl') as string | null;
        const audioUrl = formData.get('audioUrl') as string;
        const resolution = (formData.get('resolution') as string) || '720p';

        if ((!imageFile && !imageUrl) || !audioUrl) {
            return NextResponse.json(
                { error: 'Image (file or URL) and audio URL are required' },
                { status: 400 }
            );
        }

        let imageDataUrl: string;

        if (imageUrl) {
            // Fetch image from URL and convert to base64
            console.log('Fetching image from URL:', imageUrl);
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');
            const base64 = buffer.toString('base64');
            // Detect mime type from URL or use default
            const mimeType = response.headers['content-type'] || 'image/png';
            imageDataUrl = `data:${mimeType};base64,${base64}`;
        } else if (imageFile) {
            // Convert uploaded file to base64
            const arrayBuffer = await imageFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');
            const mimeType = imageFile.type || 'image/jpeg';
            imageDataUrl = `data:${mimeType};base64,${base64}`;
        } else {
            return NextResponse.json(
                { error: 'No image provided' },
                { status: 400 }
            );
        }

        console.log('Creating video with WaveSpeed InfiniteTalk');
        console.log('Resolution:', resolution);
        console.log('Audio URL:', audioUrl);

        // Create video using WaveSpeed API
        const response = await axios.post(
            WAVESPEED_API_URL,
            {
                image: imageDataUrl,
                audio: audioUrl,
                resolution: resolution,
                seed: -1
            },
            {
                headers: {
                    'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('WaveSpeed API Response:', JSON.stringify(response.data, null, 2));

        // Extract prediction ID - WaveSpeed nests it under data.data.id
        const responseData = response.data.data || response.data;
        const predictionId = responseData.id || response.data.prediction_id || response.data.task_id;

        // Also extract the polling URL if provided
        const pollingUrl = responseData.urls?.get || null;

        if (!predictionId) {
            console.error('No prediction ID found in response:', response.data);
            throw new Error('No prediction ID returned from video API');
        }

        console.log('Video creation started, prediction ID:', predictionId);
        console.log('Polling URL:', pollingUrl);

        return NextResponse.json({
            predictionId,
            pollingUrl,
            status: responseData.status || 'processing'
        });

    } catch (error: unknown) {
        console.error('Error creating video:', error);

        let errorMessage = 'Failed to create video';
        let errorDetails = null;

        if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.message || error.message;
            errorDetails = error.response?.data;
            console.error('Axios error details:', errorDetails);
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            {
                error: errorMessage,
                details: errorDetails
            },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const predictionId = searchParams.get('predictionId');

        if (!predictionId || predictionId === 'undefined') {
            return NextResponse.json(
                { error: 'Valid prediction ID is required' },
                { status: 400 }
            );
        }

        console.log('Polling for prediction ID:', predictionId);

        // Use WaveSpeed's predictions API endpoint
        const pollUrl = `https://api.wavespeed.ai/api/v3/predictions/${predictionId}/result`;
        console.log('Polling URL:', pollUrl);

        // Poll for video status
        const response = await axios.get(pollUrl, {
            headers: {
                'Authorization': `Bearer ${WAVESPEED_API_KEY}`
            }
        });

        const data = response.data.data || response.data;
        console.log('Poll response:', JSON.stringify(data, null, 2));

        // Extract status
        const status = data.status || data.state || 'processing';

        // Extract video URL from outputs array
        let videoUrl = null;
        if (data.outputs && Array.isArray(data.outputs) && data.outputs.length > 0) {
            videoUrl = data.outputs[0];
        } else if (data.output) {
            videoUrl = data.output;
        } else if (data.result) {
            videoUrl = data.result;
        } else if (data.video_url) {
            videoUrl = data.video_url;
        }

        console.log('Extracted status:', status);
        console.log('Extracted video URL:', videoUrl);

        return NextResponse.json({
            status: status,
            videoUrl: videoUrl,
            hasNsfw: data.has_nsfw_contents && data.has_nsfw_contents.length > 0 ? data.has_nsfw_contents[0] : false
        });

    } catch (error: unknown) {
        console.error('Error polling video status:', error);

        let errorMessage = 'Failed to get video status';

        if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.message || error.message;
            console.error('Axios error:', error.response?.status, error.response?.data);
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
