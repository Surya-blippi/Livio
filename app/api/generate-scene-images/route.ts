import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { supabase, getOrCreateUser, getUserCredits, deductCredits } from '@/lib/supabase';
import { auth, currentUser } from '@clerk/nextjs/server';
import { CREDIT_COSTS } from '@/lib/credits';

// Configure fal client
fal.config({
    credentials: process.env.FAL_KEY,
});

interface Scene {
    text: string;
    keywords?: string[];
}

interface GeneratedImage {
    sceneIndex: number;
    imageUrl: string;
}

export async function POST(request: NextRequest) {
    try {
        // === AUTHENTICATION ===
        const { userId: clerkUserId } = await auth();
        if (!clerkUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 401 });
        }

        // Get or create user in Supabase
        const dbUser = await getOrCreateUser(
            clerkUserId,
            user.emailAddresses[0]?.emailAddress || '',
            user.firstName || user.username || 'User'
        );

        if (!dbUser) {
            return NextResponse.json({ error: 'Failed to verify user' }, { status: 500 });
        }

        const { scenes, topic } = await request.json() as { scenes: Scene[]; topic: string };

        if (!scenes || scenes.length === 0) {
            return NextResponse.json({ error: 'Scenes are required' }, { status: 400 });
        }

        // === CREDIT CHECK ===
        const totalCost = scenes.length * CREDIT_COSTS.MOTION_SCENE_IMAGE;

        const userCredits = await getUserCredits(dbUser.id);
        if (!userCredits || userCredits.balance < totalCost) {
            return NextResponse.json(
                {
                    error: `Insufficient credits. Need ${totalCost}, have ${userCredits?.balance || 0}`,
                    creditsNeeded: totalCost,
                    currentBalance: userCredits?.balance || 0
                },
                { status: 402 }
            );
        }

        console.log(`[Motion Images] Generating ${scenes.length} scene images for topic: ${topic}`);
        console.log(`  💳 Total credits: ${totalCost}`);

        const generatedImages: GeneratedImage[] = [];

        // Generate images for each scene
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const keywords = scene.keywords?.join(', ') || '';

            // Build contextual prompt for the scene
            const prompt = `Create a photorealistic, cinematic vertical image for a short-form video about "${topic}".

Scene content: "${scene.text}"
${keywords ? `Visual keywords: ${keywords}` : ''}

Requirements:
- Vertical 9:16 aspect ratio (portrait mode for social media)
- Photorealistic, high-quality, vibrant colors
- Engaging visual that supports the narration
- No text, logos, or watermarks
- Professional broadcast quality
- Dynamic composition suitable for video content`;

            console.log(`[Motion Images] Generating image ${i + 1}/${scenes.length}...`);

            try {
                const result = await fal.subscribe('fal-ai/nano-banana-pro', {
                    input: {
                        prompt,
                        aspect_ratio: '9:16',
                        resolution: '2K',
                        output_format: 'png',
                        num_images: 1,
                    },
                    logs: false,
                });

                const imageUrl = result.data?.images?.[0]?.url;

                if (imageUrl) {
                    // Upload to Supabase storage for persistence
                    let finalUrl = imageUrl;
                    try {
                        const imageResponse = await fetch(imageUrl);
                        const imageBuffer = await imageResponse.arrayBuffer();
                        const buffer = Buffer.from(imageBuffer);

                        const fileName = `motion-images/${dbUser.id}/${Date.now()}_scene_${i}.png`;

                        const { error: uploadError } = await supabase.storage
                            .from('videos')
                            .upload(fileName, buffer, {
                                contentType: 'image/png',
                                upsert: true
                            });

                        if (!uploadError) {
                            const { data } = supabase.storage.from('videos').getPublicUrl(fileName);
                            finalUrl = data.publicUrl;
                        }
                    } catch (uploadErr) {
                        console.warn(`[Motion Images] Failed to persist image ${i}:`, uploadErr);
                        // Continue with temporary URL
                    }

                    generatedImages.push({
                        sceneIndex: i,
                        imageUrl: finalUrl,
                    });

                    console.log(`  ✅ Scene ${i + 1} image generated`);
                } else {
                    console.error(`[Motion Images] No image generated for scene ${i}`);
                }
            } catch (genError) {
                console.error(`[Motion Images] Failed to generate scene ${i}:`, genError);
                // Continue with other scenes
            }
        }

        // === DEDUCT CREDITS (only for successfully generated images) ===
        const actualCost = generatedImages.length * CREDIT_COSTS.MOTION_SCENE_IMAGE;
        if (actualCost > 0) {
            const deductResult = await deductCredits(
                dbUser.id,
                actualCost,
                'Motion Scene Image Generation',
                { sceneCount: generatedImages.length, topic: topic.substring(0, 50) }
            );

            if (!deductResult.success) {
                console.warn('[Motion Images] Failed to deduct credits:', deductResult.error);
            }
        }

        console.log(`[Motion Images] Generated ${generatedImages.length}/${scenes.length} images`);

        return NextResponse.json({
            success: true,
            images: generatedImages,
            creditsUsed: actualCost,
        });

    } catch (error: unknown) {
        console.error('[Motion Images] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to generate scene images';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
