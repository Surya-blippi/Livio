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
                'User-Agent': 'Mozilla/5.0 (compatible; PocketInfluencer/1.0)',
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
        const wordCount = Math.floor(duration * 2.5);

        // Configure model with high thinking level
        const config: any = {
            thinkingConfig: {
                thinkingLevel: 'high',
            },
        };

        const model = 'gemini-3-flash-preview';

        // Create prompt - different based on whether we have URL content
        let prompt: string;

        if (urlContent) {
            prompt = `You are a viral content creator. Generate a ${duration}-second spoken script based on the following source content.

SOURCE CONTENT:
${urlContent}

${inputTopic ? `Additional context: ${inputTopic}` : ''}

REQUIREMENTS:
1. START WITH A POWERFUL HOOK - The first 3 seconds must grab attention:
   - Use a surprising fact, bold claim, or intriguing question
   - Examples: "Here's what nobody tells you about...", "This changed everything I knew about...", "Stop scrolling - you need to hear this..."
   
2. CONTENT:
   - Approximately ${wordCount} words (${duration} seconds at normal speaking pace)
   - Extract the most interesting/valuable insights from the source
   - Make it conversational and engaging
   - Add personal touch ("I just learned...", "This blew my mind...")
   
3. FORMAT:
   - Natural spoken language only
   - No stage directions, emojis, or formatting
   - End with a call-to-action or thought-provoking statement
   
4. Just output the spoken words, nothing else.

Script:`;
        } else {
            prompt = `You are a viral content creator. Generate a ${duration}-second spoken script about "${topic}". 

REQUIREMENTS:
1. START WITH A POWERFUL HOOK - The first 3 seconds must grab attention:
   - Use a surprising fact, bold claim, or intriguing question
   - Examples: "Here's what nobody tells you about...", "This changed everything...", "Stop scrolling..."
   
2. CONTENT:
   - Approximately ${wordCount} words (${duration} seconds at normal speaking pace)
   - Enthusiastic and engaging tone
   - Provide real value or entertainment
   
3. FORMAT:
   - Natural spoken language only
   - No stage directions, emojis, or formatting
   - Direct and conversational
   
4. Just output the spoken words, nothing else.

Topic: ${topic}

Script:`;
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
