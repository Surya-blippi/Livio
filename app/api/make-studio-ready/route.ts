import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { getOrCreateUser, getUserCredits, deductCredits } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { auth, currentUser } from '@clerk/nextjs/server';
import { CREDIT_COSTS } from '@/lib/credits';

// Configure fal client
fal.config({
    credentials: process.env.FAL_KEY,
});

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

        const { imageUrl, style = 'professional' } = await request.json();

        if (!imageUrl) {
            return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
        }

        // === CREDIT DEDUCTION ===
        const cost = CREDIT_COSTS.AI_IMAGE; // 45 credits

        // Check credits
        const userCredits = await getUserCredits(dbUser.id);
        if (!userCredits || userCredits.balance < cost) {
            return NextResponse.json(
                {
                    error: `Insufficient credits. Need ${cost}, have ${userCredits?.balance || 0}`,
                    creditsNeeded: cost,
                    currentBalance: userCredits?.balance || 0
                },
                { status: 402 }
            );
        }

        // Deduct credits
        const deductResult = await deductCredits(
            dbUser.id,
            cost,
            'Studio Ready Image Generation',
            { imageUrl: imageUrl.substring(0, 100) + '...' }
        );

        if (!deductResult.success) {
            return NextResponse.json({ error: 'Failed to process credit deduction' }, { status: 500 });
        }

        console.log('[Studio Ready] Processing image:', imageUrl);
        console.log(`  💳 Credits deducted: ${cost}`);

        // Style-specific prompts
        const stylePrompts: Record<string, string> = {
            podcaster: `Transform this person into a professional podcaster portrait.

Requirements:
- Person facing directly at the camera, looking straight ahead
- Include a professional studio podcast microphone on a boom arm, slightly off-center near the mouth, softly lit, not obscuring the face
- Vertical 9:16 aspect ratio perfect for social media
- Professional studio lighting with soft shadows
- Clean, minimal gradient or solid background
- Keep the EXACT same facial features, face shape, and appearance
- Professional attire (blazer or smart casual)
- Confident, engaging expression
- High quality, sharp, broadcast-ready image
- The person should look like a podcast host delivering expert content`,

            casual: `Transform this person into a friendly, approachable content creator portrait.

Requirements:
- Person facing directly at the camera, looking straight ahead
- Vertical 9:16 aspect ratio perfect for social media
- Natural, warm lighting
- Clean, simple background (solid color or subtle gradient)
- Keep the EXACT same facial features, face shape, and appearance
- Casual, relaxed attire (t-shirt or casual shirt)
- Warm, friendly smile
- High quality, sharp, social media-ready image
- The person should look approachable and relatable`,

            trendy: `Transform this person into a stylish, modern influencer portrait.

Requirements:
- Person facing directly at the camera, looking straight ahead
- Vertical 9:16 aspect ratio perfect for social media
- Aesthetic, trendy lighting with creative color tones
- Visually interesting background with bokeh or gradient
- Keep the EXACT same facial features, face shape, and appearance
- Fashionable, trendy attire (streetwear or stylish outfit)
- Confident, cool expression
- High quality, sharp, Instagram-ready image
- The person should look like a modern content creator`,

            minimal: `Transform this person into a clean, minimalist portrait.

Requirements:
- Person facing directly at the camera, looking straight ahead
- Vertical 9:16 aspect ratio perfect for social media
- Soft, even lighting
- Pure white or very light solid background
- Keep the EXACT same facial features, face shape, and appearance
- Simple, neutral attire (plain shirt or top)
- Neutral, calm expression
- High quality, sharp, clean image
- The person should look professional yet understated`
        };

        // Use the style from request (already parsed above)
        const prompt = stylePrompts[style] || stylePrompts.professional;

        console.log(`[Studio Ready] Using style: ${style}`);

        // Use Nano Banana Pro to transform the image
        const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
            input: {
                prompt,
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

        // --- NEW: Persist image to Supabase ---
        let finalStudioUrl = generatedImage.url;
        try {
            console.log('[Studio Ready] Downloading generated image...', generatedImage.url);
            const imageResponse = await fetch(generatedImage.url);
            const imageBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(imageBuffer);

            const supabaseAdmin = getSupabaseAdmin(); // Use admin client for storage and DB operations
            // Ideally use service role key for storage uploads if user token doesn't allow it, 
            // but here we are in API route context.
            // Let's assume standard client works if RLS allows, otherwise might need admin client. 
            // The lib/supabase exports 'supabase' which is admin if key is service role, or public otherwise.
            // Let's rely on standard path.

            const fileName = `studio-avatars/${dbUser.id}/studio_${Date.now()}.png`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from('avatars') // Using 'avatars' bucket which likely exists or 'videos'
                .upload(fileName, buffer, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (uploadError) {
                // Try 'videos' bucket if 'avatars' doesn't exist/work, or just log error
                console.warn('[Studio Ready] Failed to upload to avatars bucket:', uploadError);

                // Fallback to 'videos' bucket just in case
                const { error: videoUploadError } = await supabaseAdmin.storage
                    .from('videos')
                    .upload(fileName, buffer, {
                        contentType: 'image/png',
                        upsert: true
                    });

                if (videoUploadError) {
                    console.error('[Studio Ready] Failed to upload to storage:', videoUploadError);
                    // Fallback to original URL if upload fails, though it will expire
                } else {
                    const { data } = supabaseAdmin.storage.from('videos').getPublicUrl(fileName);
                    finalStudioUrl = data.publicUrl;
                }
            } else {
                const { data } = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName);
                finalStudioUrl = data.publicUrl;
            }

            // 2. Persist to DB immediately
            const { error: dbError } = await supabaseAdmin
                .from('avatars')
                .insert({
                    user_id: dbUser.id,
                    image_url: finalStudioUrl,
                    name: `Studio ${style}`,
                    is_default: true // Auto-set as default since they just generated it
                });

            if (dbError) {
                console.error('[Studio Ready] Failed to save to DB:', dbError);
                // We don't fail the request, but we log it. 
                // The frontend relies on the returned studioReadyUrl anyway.
            } else {
                console.log('[Studio Ready] Saved to DB successfully');

                // Unset other defaults for this user to ensure only one is default
                await supabaseAdmin
                    .from('avatars')
                    .update({ is_default: false })
                    .eq('user_id', dbUser.id)
                    .neq('image_url', finalStudioUrl);
            }

        } catch (persistError) {
            console.error('[Studio Ready] Error persisting image:', persistError);
            // Proceed with temporary URL if persistence fails
        }

        return NextResponse.json({
            success: true,
            originalUrl: imageUrl,
            studioReadyUrl: finalStudioUrl,
            description: result.data?.description || 'Studio-ready portrait generated',
        });

    } catch (error: unknown) {
        console.error('[Studio Ready] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to process image';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
