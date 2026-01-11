import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({
    apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
});

export interface Scene {
    text: string;
    keywords: string[];
}

export async function POST(request: NextRequest) {
    try {
        const { script, duration = 30 } = await request.json();

        if (!script || typeof script !== 'string') {
            return NextResponse.json({ error: 'Script is required' }, { status: 400 });
        }

        console.log('[Regenerate Scenes] Starting scene generation from script...');
        console.log('[Regenerate Scenes] Script length:', script.length, 'chars');

        // Calculate number of scenes based on duration
        const numScenes = Math.max(3, Math.min(6, Math.round(duration / 6)));

        const prompt = `Break this video script into ${numScenes} distinct SCENES for video production.

SCRIPT:
${script}

OUTPUT FORMAT (JSON only):
{
  "scenes": [
    {
      "text": "The narration text for this scene...",
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}

RULES:
1. Each scene should have 1-3 sentences of narration
2. Keywords should be visual (good for image search)
3. Preserve the exact wording from the script - just divide it into scenes
4. Scene 1 should be the hook/opening
5. Last scene should be the conclusion/call-to-action

CRITICAL: Output ONLY valid JSON. No text before or after. No markdown code blocks.`;

        const config: Record<string, unknown> = {
            thinkingConfig: {
                thinkingLevel: 'high',
            },
        };

        const model = 'gemini-3-flash-preview';

        const contents = [
            {
                role: 'user' as const,
                parts: [{ text: prompt }],
            },
        ];

        const response = await ai.models.generateContentStream({
            model,
            config,
            contents,
        });

        let fullResponse = '';
        for await (const chunk of response) {
            if (chunk.text) {
                fullResponse += chunk.text;
            }
        }

        console.log('[Regenerate Scenes] Raw response:', fullResponse.slice(0, 300));

        // Parse JSON response
        let scenes: Scene[] = [];
        try {
            let jsonStr = fullResponse.trim();
            // Remove markdown code blocks if present
            jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');

            // Find JSON object in the text
            const jsonMatch = jsonStr.match(/\{[\s\S]*"scenes"[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }

            const parsed = JSON.parse(jsonStr);

            if (parsed.scenes && Array.isArray(parsed.scenes)) {
                scenes = parsed.scenes
                    .filter((s: { text?: string }) => s.text && typeof s.text === 'string')
                    .map((s: { text: string; keywords?: string[] }) => ({
                        text: s.text.trim(),
                        keywords: Array.isArray(s.keywords) ? s.keywords : []
                    }));
            }
        } catch (parseError) {
            console.error('[Regenerate Scenes] JSON parse error:', parseError);

            // Fallback: Split script into sentences and group them
            const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];
            const scenesPerGroup = Math.ceil(sentences.length / numScenes);

            for (let i = 0; i < sentences.length; i += scenesPerGroup) {
                const sceneText = sentences.slice(i, i + scenesPerGroup).join(' ').trim();
                if (sceneText) {
                    const words = sceneText.split(/\s+/).filter((w: string) => w.length > 4);
                    scenes.push({
                        text: sceneText,
                        keywords: words.slice(0, 3)
                    });
                }
            }
        }

        if (scenes.length === 0) {
            // Ultimate fallback: treat entire script as one scene
            scenes = [{ text: script, keywords: [] }];
        }

        console.log('[Regenerate Scenes] Generated', scenes.length, 'scenes');

        return NextResponse.json({
            success: true,
            scenes,
        });

    } catch (error: unknown) {
        console.error('[Regenerate Scenes] Error:', error);
        const msg = error instanceof Error ? error.message : 'Failed to regenerate scenes';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
