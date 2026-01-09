import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

// Configure fal client
fal.config({
    credentials: process.env.FAL_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { imageUrl } = await request.json();

        if (!imageUrl) {
            return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
        }

        console.log('[Studio Ready] Processing image:', imageUrl);

        // Use Nano Banana Pro to transform the image
        const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
            input: {
                prompt: `Transform this person into a professional podcast speaker portrait. 
                
Requirements:
- Vertical 9:16 aspect ratio perfect for social media
- Professional studio lighting with soft shadows
- Clean, minimal gradient or solid background
- Keep the EXACT same facial features, face shape, and appearance
- Professional attire (blazer or smart casual)
- Confident, engaging expression
- High quality, sharp, broadcast-ready image
- The person should look like they're about to deliver insightful content`,
                image_urls: [imageUrl],
                aspect_ratio: '9:16',
                resolution: '2K',
                output_format: 'png',
                num_images: 1,
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_PROGRESS' && update.logs) {
                    update.logs.forEach((log) => console.log('[Studio Ready]', log.message));
                }
            },
        });

        console.log('[Studio Ready] Result:', result);

        // Extract the generated image URL
        const generatedImage = result.data?.images?.[0];

        if (!generatedImage?.url) {
            console.error('[Studio Ready] No image generated:', result);
            return NextResponse.json({ error: 'Failed to generate studio-ready image' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            originalUrl: imageUrl,
            studioReadyUrl: generatedImage.url,
            description: result.data?.description || 'Studio-ready portrait generated',
        });

    } catch (error: unknown) {
        console.error('[Studio Ready] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to process image';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
