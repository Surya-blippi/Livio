import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateUser, hasEnoughCredits, deductCredits } from '@/lib/supabase';
import { CREDIT_COSTS } from '@/lib/credits';

const MANUS_API_URL = 'https://api.manus.ai';

// ... (keep existing interfaces and helper functions)

// Scene structure for video generation
export interface Scene {
    text: string;           // The narration for this scene
    keywords: string[];     // 2-3 keywords for image search
}

export interface SceneScript {
    scenes: Scene[];
    fullScript: string;     // Combined script for TTS
}

// ... (keep createEnhanceTask, pollManusTask, parseSceneScript, extractPlainScript functions)

/**
 * Create a Manus AI task to research and write a scene-based script
 */
async function createEnhanceTask(topic: string, duration: number): Promise<string | null> {
    // Calculate target word count range based on duration
    let wordCountRange = '';
    if (duration <= 15) wordCountRange = '30-45 words';
    else if (duration <= 30) wordCountRange = '65-80 words';
    else if (duration <= 60) wordCountRange = '130-160 words';
    else wordCountRange = `${Math.floor(duration * 2.2)}-${Math.floor(duration * 2.7)} words`;

    // Calculate number of scenes based on duration
    const numScenes = Math.max(3, Math.min(6, Math.round(duration / 6)));

    const prompt = `Research "${topic}" and write a ${duration}-second video script broken into ${numScenes} SCENES.

OUTPUT FORMAT (JSON):
{
  "scenes": [
    {
      "text": "The narration text for this scene...",
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}

SCENE STRUCTURE:
- Scene 1: HOOK - Start with a shocking question, surprising fact, or vivid imagery
- Scene 2-${numScenes - 1}: KEY FACTS & NARRATIVE - Include specific facts, dates, numbers from research
- Scene ${numScenes}: ENDING - End with something memorable (twist, open question, powerful statement)

RULES:
- Total LENGTH: STRICTLY ${wordCountRange} across all scenes
- Each scene should be 1-3 sentences
- Keywords should be visual (good for image search)
- Write for spoken delivery (natural, conversational)
- Make it feel like a mini-documentary

CRITICAL: 
- Output ONLY valid JSON.
- DO NOT write "Here is the JSON" or "I have researched...".
- NO markdown code blocks (like \`\`\`json).
- DO NOT create a downloadable file. PRINT the JSON string directly in the text response.
- JUST THE RAW JSON OBJECT.`;

    try {
        console.log('[Manus Enhance] Creating task...');

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
        console.log('[Manus Enhance] Task created:', taskId);
        return taskId;
    } catch (error: unknown) {
        const axiosError = error as { response?: { status?: number; data?: unknown } };
        console.error('[Manus Enhance] Create task error:', axiosError.response?.status, axiosError.response?.data || error);
        return null;
    }
}

/**
 * Poll Manus AI task for completion
 */
async function pollManusTask(taskId: string): Promise<string | null> {
    const maxAttempts = 40; // 40 * 3s = 120s max (2 minutes)
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            console.log(`[Manus Enhance] Polling task ${taskId} (attempt ${attempts + 1}/${maxAttempts})...`);

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
            console.log(`[Manus Enhance] Task status: ${status}`);

            if (status === 'completed') {
                console.log('[Manus Enhance] FULL RESPONSE:', JSON.stringify(response.data, null, 2));

                // Extract output text
                const output = response.data?.output || [];
                let text = '';

                for (const message of output) {
                    if (message.role === 'assistant' && message.content) {
                        for (const content of message.content) {
                            if (content.type === 'output_text' && content.text) {
                                text += content.text + '\n';
                            }
                        }
                    }
                }

                return text.trim();
            } else if (status === 'failed') {
                console.error('[Manus Enhance] Task failed:', response.data?.error);
                return null;
            }

            // Wait 3 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 3000));
            attempts++;
        } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number; data?: unknown } };
            console.error('[Manus Enhance] Poll error:', axiosError.response?.status || error);
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    console.error('[Manus Enhance] Task timed out');
    return null;
}

/**
 * Parse the scene-structured JSON response from Manus
 */
function parseSceneScript(text: string): SceneScript | null {
    try {
        // Try to extract JSON from the response
        let jsonStr = text.trim();

        // Remove markdown code blocks if present
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        // Find JSON object in the text
        const jsonMatch = jsonStr.match(/\{[\s\S]*"scenes"[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        const parsed = JSON.parse(jsonStr);

        if (parsed.scenes && Array.isArray(parsed.scenes)) {
            // Validate and clean scenes
            const scenes: Scene[] = parsed.scenes
                .filter((s: { text?: string }) => s.text && typeof s.text === 'string')
                .map((s: { text: string; keywords?: string[] }) => ({
                    text: s.text.trim(),
                    keywords: Array.isArray(s.keywords) ? s.keywords : []
                }));

            if (scenes.length > 0) {
                // Combine all scene texts for TTS
                const fullScript = scenes.map(s => s.text).join(' ');

                console.log(`[Manus Enhance] Parsed ${scenes.length} scenes`);
                return { scenes, fullScript };
            }
        }
    } catch (error) {
        console.error('[Manus Enhance] JSON parse error:', error);
    }

    return null;
}

/**
 * Fallback: Extract plain script if JSON parsing fails
 */
function extractPlainScript(text: string): string {
    // Remove common preamble patterns
    let script = text
        .replace(/^I will research.*$/gim, '')
        .replace(/^I('ll| will) (now )?(research|write|create).*$/gim, '')
        .replace(/^Here('s| is) (your|the) script.*$/gim, '')
        .replace(/^Let me.*$/gim, '')
        .replace(/^Sure,.*$/gim, '')
        .replace(/^#+\s.*$/gm, '')
        .replace(/^\*\*.*\*\*$/gm, '')
        .replace(/^[-*]\s/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .trim();

    // If there are multiple paragraphs, take the longest one
    const paragraphs = script.split(/\n\n+/).filter(p => p.length > 50);
    if (paragraphs.length > 0) {
        script = paragraphs.reduce((a, b) => a.length > b.length ? a : b);
    }

    return script.trim();
}

export async function POST(request: NextRequest) {
    try {
        const { topic, duration = 30 } = await request.json();
        const { userId: clerkId } = await auth();

        if (!clerkId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        if (!topic || typeof topic !== 'string') {
            return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
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

        const cost = CREDIT_COSTS.RESEARCH_SCRIPT;
        const hasCredits = await hasEnoughCredits(user.id, cost);

        if (!hasCredits) {
            return NextResponse.json({
                error: `Insufficient credits. This operation requires ${cost} credits.`,
                code: 'INSUFFICIENT_CREDITS'
            }, { status: 402 });
        }

        console.log('[Manus Enhance] Starting script research...');
        console.log('[Manus Enhance] Topic:', topic.slice(0, 100));
        console.log('[Manus Enhance] Duration:', duration, 'seconds');
        console.log('[Manus Enhance] User:', user.id, 'Cost:', cost);

        // Step 1: Create the task
        const taskId = await createEnhanceTask(topic, duration);
        if (!taskId) {
            return NextResponse.json({
                error: 'Failed to create research task',
                code: 'TASK_FAILED'
            }, { status: 503 });
        }

        // Step 2: Poll for completion
        const result = await pollManusTask(taskId);
        if (!result) {
            return NextResponse.json({
                error: 'Research task timed out',
                code: 'TIMEOUT'
            }, { status: 503 });
        }

        console.log('[Manus Enhance] Raw result preview:', result.slice(0, 300));

        // Step 3: Try to parse as scene-structured JSON
        const sceneScript = parseSceneScript(result);

        // Prepare response data
        let responseData;

        if (sceneScript) {
            console.log('[Manus Enhance] Scene-based script generated successfully');
            console.log('[Manus Enhance] Full script length:', sceneScript.fullScript.length);

            responseData = {
                success: true,
                script: sceneScript.fullScript,  // Backwards compatibility
                scenes: sceneScript.scenes,       // New scene data
            };
        } else {
            // Fallback: If JSON parsing fails, extract plain script
            console.log('[Manus Enhance] Falling back to plain script extraction');
            const plainScript = extractPlainScript(result);

            // Create synthetic scenes from plain script (split by sentences)
            const sentences = plainScript.match(/[^.!?]+[.!?]+/g) || [plainScript];
            const scenesPerGroup = Math.ceil(sentences.length / 4);
            const syntheticScenes: Scene[] = [];

            for (let i = 0; i < sentences.length; i += scenesPerGroup) {
                const sceneText = sentences.slice(i, i + scenesPerGroup).join(' ').trim();
                if (sceneText) {
                    // Extract nouns as keywords (simple heuristic)
                    const words = sceneText.split(/\s+/).filter(w => w.length > 4);
                    syntheticScenes.push({
                        text: sceneText,
                        keywords: words.slice(0, 3)
                    });
                }
            }

            console.log('[Manus Enhance] Created', syntheticScenes.length, 'synthetic scenes');

            responseData = {
                success: true,
                script: plainScript,
                scenes: syntheticScenes,
            };
        }

        // Deduct credits on success
        await deductCredits(user.id, cost, 'Generated script with Manus AI', {
            topic,
            duration
        });

        return NextResponse.json(responseData);

    } catch (error: unknown) {
        console.error('[Manus Enhance] Error:', error);
        const msg = error instanceof Error ? error.message : 'Failed to enhance script';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
