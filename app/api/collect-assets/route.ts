import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits } from '@/lib/supabase';
import { CREDIT_COSTS } from '@/lib/credits';

// Read API key at request time, not module load time
const MANUS_API_URL = 'https://api.manus.ai';

// ... (keep existing interfaces and functions createManusTask, pollManusTask, parseManusResponse, collectImagesWithManus)

interface CollectedAsset {
    url: string;
    thumbnail: string;
    title: string;
    source: string;
    searchTerm: string;
}

/**
 * Create a Manus AI task to find relevant images for a script
 */
async function createManusTask(script: string, topic: string): Promise<string | null> {
    // Extract topic from script if not provided
    const effectiveTopic = topic || script.slice(0, 100);

    const prompt = `Find 6 relevant images of "${effectiveTopic}" from Google Images. Avoid stock photos, use real news/editorial images only.

IMPORTANT: Download each image and save it to your sandbox. Then provide the file paths.

For each image, after downloading, tell me the filename you saved it as.`;

    try {
        console.log('[Manus] Creating task...');

        const response = await axios.post(
            `${MANUS_API_URL}/v1/tasks`,
            {
                prompt,
                agentProfile: 'manus-1.6',
                taskMode: 'agent',
                hideInTaskList: true,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'API_KEY': process.env.MANUS_API_KEY || '',
                },
                timeout: 30000,
            }
        );

        const taskId = response.data?.task_id;
        console.log('[Manus] Task created:', taskId);
        return taskId;
    } catch (error: unknown) {
        const axiosError = error as { response?: { status?: number; data?: unknown } };
        console.error('[Manus] Create task error:', axiosError.response?.status, axiosError.response?.data || error);
        return null;
    }
}

/**
 * Poll Manus AI task for completion and get results
 */
async function pollManusTask(taskId: string): Promise<{ text: string; files: Array<{ url: string; name: string }> } | null> {
    const maxAttempts = 60; // 60 * 3s = 180s max (3 minutes)
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            console.log(`[Manus] Polling task ${taskId} (attempt ${attempts + 1}/${maxAttempts})...`);

            const response = await axios.get(
                `${MANUS_API_URL}/v1/tasks/${taskId}`,
                {
                    headers: {
                        'API_KEY': process.env.MANUS_API_KEY || '',
                    },
                    timeout: 15000,
                }
            );

            const status = response.data?.status;
            console.log(`[Manus] Task status: ${status}`);

            if (status === 'completed') {
                // Extract output text and files
                const output = response.data?.output || [];
                let text = '';
                const files: Array<{ url: string; name: string }> = [];

                for (const message of output) {
                    if (message.role === 'assistant' && message.content) {
                        for (const content of message.content) {
                            if (content.type === 'output_text' && content.text) {
                                text += content.text + '\n';
                            } else if (content.type === 'output_file' && content.fileUrl) {
                                console.log(`[Manus] Found file: ${content.fileName} at ${content.fileUrl}`);
                                files.push({ url: content.fileUrl, name: content.fileName || 'file' });
                            }
                        }
                    }
                }

                return { text, files };
            } else if (status === 'failed') {
                console.error('[Manus] Task failed:', response.data?.error);
                return null;
            }

            // Wait 3 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 3000));
            attempts++;
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number; data?: unknown } };
            console.error('[Manus] Poll error:', axiosError.response?.status || error);
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    console.error('[Manus] Task timed out');
    return null;
}

/**
 * Parse Manus response to extract image URLs
 */
function parseManusResponse(responseText: string): CollectedAsset[] {
    const assets: CollectedAsset[] = [];

    try {
        // Try to extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*"images"[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            const images = data.images || [];

            for (const img of images) {
                // Handle both old format (url) and new format (image_url)
                const imageUrl = img.image_url || img.url;

                if (imageUrl && imageUrl.startsWith('http')) {
                    const url = imageUrl;

                    // Validate URL looks like an actual image
                    const isValidImageUrl =
                        /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url) ||
                        url.includes('/photo') ||
                        url.includes('/image') ||
                        url.includes('wp-content') ||
                        url.includes('media') ||
                        url.includes('upload') ||
                        url.includes('cdn');

                    // Exclude stock photo sites and AI/Pinterest
                    const isExcluded =
                        url.includes('unsplash.com') ||
                        url.includes('pexels.com') ||
                        url.includes('shutterstock') ||
                        url.includes('istockphoto') ||
                        url.includes('gettyimages') ||
                        url.includes('adobestock') ||
                        url.includes('pinterest') ||
                        url.includes('midjourney') ||
                        url.includes('dalle');

                    if (isValidImageUrl && !isExcluded) {
                        assets.push({
                            url: imageUrl,
                            thumbnail: imageUrl,
                            title: img.context || img.caption_or_context || img.title || img.why_selected || 'Editorial Image',
                            source: img.source_name || img.source || 'web',
                            searchTerm: img.why_selected || 'editorial-search',
                        });
                    }
                }
            }
        }

        // Fallback: extract any image URLs directly from text (excluding stock sites)
        if (assets.length === 0) {
            const urlRegex = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp|gif)(\?[^\s"'<>]*)?/gi;
            let match;
            while ((match = urlRegex.exec(responseText)) !== null) {
                const url = match[0];
                // Skip stock photo sites
                const isStockPhoto =
                    url.includes('unsplash.com') ||
                    url.includes('pexels.com') ||
                    url.includes('shutterstock') ||
                    url.includes('istockphoto');

                if (!isStockPhoto && !assets.some(a => a.url === url)) {
                    assets.push({
                        url,
                        thumbnail: url,
                        title: 'Image',
                        source: 'web',
                        searchTerm: 'google-search',
                    });
                }
            }
        }
    } catch (error) {
        console.error('[Manus] Parse error:', error);
    }

    return assets.slice(0, 10);
}

/**
 * Collect images using Manus AI
 */
async function collectImagesWithManus(script: string, topic: string): Promise<CollectedAsset[]> {
    const apiKey = process.env.MANUS_API_KEY;
    console.log('[Manus] API Key present:', !!apiKey, 'Key prefix:', apiKey?.slice(0, 10) + '...');

    if (!apiKey) {
        throw new Error('MANUS_API_KEY is required');
    }

    // Step 1: Create the task
    const taskId = await createManusTask(script, topic);
    if (!taskId) {
        throw new Error('Failed to create Manus task');
    }

    // Step 2: Poll for completion
    const result = await pollManusTask(taskId);
    if (!result) {
        throw new Error('Manus task did not return results');
    }

    console.log('[Manus] Response received, parsing...');
    console.log('[Manus] Text preview:', result.text.slice(0, 300));
    console.log('[Manus] Files found:', result.files.length);

    let assets: CollectedAsset[] = [];

    // Step 3: First, use any image files that Manus downloaded directly
    for (const file of result.files) {
        const isImageFile = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
        if (isImageFile && file.url) {
            console.log(`[Manus] Found image file: ${file.name} at ${file.url}`);
            assets.push({
                url: file.url,
                thumbnail: file.url,
                title: file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
                source: 'manus-download',
                searchTerm: 'manus-ai',
            });
        }
    }

    console.log(`[Manus] Found ${assets.length} directly downloaded image files`);

    // Step 4: If no image files, try JSON files
    if (assets.length === 0) {
        for (const file of result.files) {
            if (file.name.endsWith('.json')) {
                try {
                    console.log(`[Manus] Fetching JSON file: ${file.url}`);
                    const fileResponse = await axios.get(file.url, { timeout: 15000 });
                    const fileData = fileResponse.data;

                    // Parse the JSON file content
                    const images = fileData.images || fileData || [];
                    for (const img of (Array.isArray(images) ? images : [])) {
                        const imgUrl = img.image_url || img.url;
                        if (imgUrl && imgUrl.startsWith('http')) {
                            assets.push({
                                url: imgUrl,
                                thumbnail: imgUrl,
                                title: img.title || 'Image',
                                source: img.source || 'manus',
                                searchTerm: 'manus-ai',
                            });
                        }
                    }
                    console.log(`[Manus] Parsed ${assets.length} images from JSON file`);
                } catch (error) {
                    console.error(`[Manus] Failed to fetch file ${file.url}:`, error);
                }
            }
        }
    }

    // Step 5: If still no assets, try parsing text response
    if (assets.length === 0 && result.text) {
        assets = parseManusResponse(result.text);
    }

    // Step 6: Remove duplicates based on URL
    const seenUrls = new Set<string>();
    const uniqueAssets = assets.filter(asset => {
        if (seenUrls.has(asset.url)) {
            return false;
        }
        seenUrls.add(asset.url);
        return true;
    });

    console.log(`[Manus] Total collected ${uniqueAssets.length} unique images (removed ${assets.length - uniqueAssets.length} duplicates)`);
    return uniqueAssets.slice(0, 10);
}

export async function POST(request: NextRequest) {
    try {
        const { script, topic } = await request.json();
        const { userId: clerkId } = await auth();

        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        if (!script || typeof script !== 'string') {
            return NextResponse.json({ error: 'Script is required' }, { status: 400 });
        }

        if (!process.env.MANUS_API_KEY) {
            return NextResponse.json({ error: 'MANUS_API_KEY is required' }, { status: 500 });
        }

        // 1. Get user and check credits
        const currentUserData = await currentUser();
        const user = await getOrCreateUser(
            clerkId,
            currentUserData?.emailAddresses[0]?.emailAddress || '',
            currentUserData?.firstName || undefined,
            currentUserData?.imageUrl || undefined
        );

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const cost = CREDIT_COSTS.ASSET_COLLECTION;
        const hasCredits = await hasEnoughCredits(user.id, cost);

        if (!hasCredits) {
            return NextResponse.json({
                error: `Insufficient credits. This operation requires ${cost} credits.`,
                code: 'INSUFFICIENT_CREDITS'
            }, { status: 402 });
        }

        console.log('[Collect Assets] Starting Manus AI image collection...');
        console.log('[Collect Assets] Script length:', script.length);
        console.log('[Collect Assets] Topic:', topic || 'none');
        console.log('[Collect Assets] User:', user.id, 'Cost:', cost);

        // Collect images using Manus AI
        const assets = await collectImagesWithManus(script, topic || '');

        // Deduct credits on success
        await deductCredits(user.id, cost, 'Collected assets with Manus AI', {
            topic,
            assetCount: assets.length
        });

        return NextResponse.json({
            success: true,
            assets,
            searchTerms: ['manus-ai-research'],
            source: 'manus-ai',
        });

    } catch (error: unknown) {
        console.error('[Collect Assets] Error:', error);
        const msg = error instanceof Error ? error.message : 'Failed to collect assets';

        // Provide user-friendly error messages
        if (msg.includes('credit limit') || msg.includes('Failed to create Manus task')) {
            return NextResponse.json({
                error: 'Image collection service credits exhausted. Please try again later or contact support.',
                code: 'CREDITS_EXHAUSTED'
            }, { status: 503 });
        }

        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
