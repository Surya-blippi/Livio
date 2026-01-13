import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({
    apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
});

// URL regex pattern
const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

// Fetch content from a URL
async function fetchUrlContent(url: string): Promise<string> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; RevenPocketCreator/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
            console.error(`Failed to fetch ${url}: ${response.status}`);
            return '';
        }

        const html = await response.text();

        // Extract text content from HTML (basic extraction)
        // Remove script and style tags
        let text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';

        // Extract meta description
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        const description = descMatch ? descMatch[1].trim() : '';

        // Extract main content (paragraphs and headings)
        const paragraphs: string[] = [];
        const pMatches = text.matchAll(/<(p|h1|h2|h3|article)[^>]*>([\s\S]*?)<\/\1>/gi);
        for (const match of pMatches) {
            const cleanText = match[2]
                .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
                .replace(/\s+/g, ' ')     // Normalize whitespace
                .trim();
            if (cleanText.length > 20) {
                paragraphs.push(cleanText);
            }
        }

        // Combine content
        const content = [
            title && `Title: ${title}`,
            description && `Summary: ${description}`,
            paragraphs.slice(0, 10).join('\n\n')
        ].filter(Boolean).join('\n\n');

        return content.slice(0, 5000); // Limit content length
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return '';
    }
}

export async function POST(request: NextRequest) {
    try {
        const { topic, duration = 10 } = await request.json();

        if (!topic || typeof topic !== 'string') {
            return NextResponse.json(
                { error: 'Topic is required and must be a string' },
                { status: 400 }
            );
        }

        // Check if input contains URLs
        const urls = topic.match(urlPattern) || [];
        let urlContent = '';
        let inputTopic = topic;

        if (urls.length > 0) {
            console.log(`Found ${urls.length} URLs in input, fetching content...`);

            // Fetch content from all URLs (limit to 3)
            const urlsToFetch = urls.slice(0, 3);
            const contents = await Promise.all(urlsToFetch.map(fetchUrlContent));
            urlContent = contents.filter(Boolean).join('\n\n---\n\n');

            // Remove URLs from topic to get any additional context
            inputTopic = topic.replace(urlPattern, '').trim();

            console.log(`Fetched ${contents.filter(Boolean).length} URL contents`);
        }

        // Calculate word count: approx 2.5 words per second
        // Calculate target word count range based on duration
        let wordCountRange = '';
        if (duration <= 15) wordCountRange = '30-45 words';
        else if (duration <= 30) wordCountRange = '65-80 words';
        else if (duration <= 60) wordCountRange = '130-160 words';
        else wordCountRange = `${Math.floor(duration * 2.2)}-${Math.floor(duration * 2.7)} words`;

        // Configure model with valid generation config
        const config: any = {
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1000,
            }
        };

        const model = 'gemini-2.0-flash-exp'; // Use standard model for better instruction following

        // Create prompt - different based on whether we have URL content
        let prompt: string;

        const contentInstructions = `
REQUIREMENTS:
1. LENGTH constraint: STRICTLY ${wordCountRange}.
   - 15s video = ~40 words
   - 30s video = ~75 words
   - 60s video = ~145 words
   - DO NOT write a long blog post. Keep it concise for video.

2. STRUCTURE:
   - Hook (First 3s): Grab attention immediately.
   - Body: Deliver value/story.
   - CTA: Short specific call to action.

3. TONE:
   - Conversational, high-energy, viral style.
   - No "Ladies and gentlemen" or formal intros.

4. FORMATTING RULES (CRITICAL):
   - START DIRECTLY with the spoken words.
   - NO "Here is the script", NO "Title:", NO "Scene 1".
   - NO formatting tags like **bold** or [brackets].
   - RAW TEXT ONLY.
`;

        if (urlContent) {
            prompt = `You are a viral content creator. Generate a ${duration}-second spoken script based on the following source content.
            
SOURCE CONTENT:
${urlContent}

${inputTopic ? `Focus Topic: ${inputTopic}` : ''}

${contentInstructions}

Generate the script now:`;
        } else {
            prompt = `You are a viral content creator. Generate a ${duration}-second spoken script about "${topic}".

${contentInstructions}

Generate the script now:`;
        }

        const contents = [
            {
                role: 'user' as const,
                parts: [
                    {
                        text: prompt,
                    },
                ],
            },
        ];

        // Generate content with streaming
        const response = await ai.models.generateContentStream({
            model,
            config,
            contents,
        });

        // Collect all chunks
        let fullScript = '';
        for await (const chunk of response) {
            if (chunk.text) {
                fullScript += chunk.text;
            }
        }

        // Remove any quotation marks that might be added
        const cleanedScript = fullScript.trim().replace(/^[\"']|[\"']$/g, '');

        return NextResponse.json({
            script: cleanedScript,
            topic,
            urlsProcessed: urls.length,
        });

    } catch (error: unknown) {
        console.error('Error generating script:', error);

        const errorMessage = error instanceof Error ? error.message : 'Failed to generate script';

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
