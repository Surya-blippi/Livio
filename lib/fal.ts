import { fal } from '@fal-ai/client';

if (!process.env.FAL_KEY) {
    console.warn("FAL_KEY is missing from environment variables.");
}

fal.config({ credentials: process.env.FAL_KEY });

/**
 * Chunk text into segments of max 300 characters, respecting sentence boundaries.
 * Chatterbox has a 300 character limit per API call.
 */
function chunkText(text: string, maxChars = 280): string[] {
    // If text is short enough, return as-is
    if (text.length <= maxChars) {
        return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxChars) {
            chunks.push(remaining.trim());
            break;
        }

        // Find best break point within limit
        let breakPoint = maxChars;

        // Try to break at sentence end (. ! ?)
        const sentenceEnd = remaining.slice(0, maxChars).lastIndexOf('. ');
        const exclamEnd = remaining.slice(0, maxChars).lastIndexOf('! ');
        const questEnd = remaining.slice(0, maxChars).lastIndexOf('? ');

        const bestSentenceBreak = Math.max(sentenceEnd, exclamEnd, questEnd);

        if (bestSentenceBreak > maxChars / 2) {
            breakPoint = bestSentenceBreak + 1; // Include the punctuation
        } else {
            // Fall back to comma or space
            const commaBreak = remaining.slice(0, maxChars).lastIndexOf(', ');
            if (commaBreak > maxChars / 2) {
                breakPoint = commaBreak + 1;
            } else {
                // Last resort: break at last space
                const spaceBreak = remaining.slice(0, maxChars).lastIndexOf(' ');
                if (spaceBreak > 0) {
                    breakPoint = spaceBreak;
                }
            }
        }

        chunks.push(remaining.slice(0, breakPoint).trim());
        remaining = remaining.slice(breakPoint).trim();
    }

    return chunks;
}

type ChatterboxLanguage = 'english' | 'arabic' | 'danish' | 'german' | 'greek' | 'spanish' | 'finnish' | 'french' | 'hebrew' | 'hindi' | 'italian' | 'japanese' | 'korean' | 'malay' | 'dutch' | 'norwegian' | 'polish' | 'portuguese' | 'russian' | 'swedish' | 'swahili' | 'turkish' | 'chinese';

/**
 * Detect the language of text based on character patterns and Unicode ranges.
 * Returns the most likely Chatterbox-supported language.
 */
function detectLanguage(text: string): ChatterboxLanguage {
    // Remove punctuation and numbers for cleaner detection
    const cleanText = text.replace(/[0-9\s.,!?;:'"()-]/g, '');

    if (cleanText.length === 0) return 'english';

    // Character range checks (Unicode blocks)
    const charCounts = {
        arabic: 0,      // Arabic: 0600-06FF
        hebrew: 0,      // Hebrew: 0590-05FF
        hindi: 0,       // Devanagari: 0900-097F
        chinese: 0,     // CJK: 4E00-9FFF
        japanese: 0,    // Hiragana/Katakana: 3040-30FF
        korean: 0,      // Hangul: AC00-D7AF, 1100-11FF
        greek: 0,       // Greek: 0370-03FF
        russian: 0,     // Cyrillic: 0400-04FF
        latin: 0,       // Latin extended: 0000-007F, 0080-00FF
    };

    for (const char of cleanText) {
        const code = char.charCodeAt(0);

        if (code >= 0x0600 && code <= 0x06FF) charCounts.arabic++;
        else if (code >= 0x0590 && code <= 0x05FF) charCounts.hebrew++;
        else if (code >= 0x0900 && code <= 0x097F) charCounts.hindi++;
        else if (code >= 0x4E00 && code <= 0x9FFF) charCounts.chinese++;
        else if ((code >= 0x3040 && code <= 0x30FF) || (code >= 0x31F0 && code <= 0x31FF)) charCounts.japanese++;
        else if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF)) charCounts.korean++;
        else if (code >= 0x0370 && code <= 0x03FF) charCounts.greek++;
        else if (code >= 0x0400 && code <= 0x04FF) charCounts.russian++;
        else if (code <= 0x024F) charCounts.latin++;
    }

    // Find dominant script
    const total = cleanText.length;
    const threshold = 0.3; // 30% of text must be in script

    if (charCounts.arabic / total > threshold) return 'arabic';
    if (charCounts.hebrew / total > threshold) return 'hebrew';
    if (charCounts.hindi / total > threshold) return 'hindi';
    if (charCounts.chinese / total > threshold) return 'chinese';
    if (charCounts.japanese / total > threshold) return 'japanese';
    if (charCounts.korean / total > threshold) return 'korean';
    if (charCounts.greek / total > threshold) return 'greek';
    if (charCounts.russian / total > threshold) return 'russian';

    // For Latin scripts, try to detect specific languages via common words/patterns
    const lowerText = text.toLowerCase();

    // Spanish indicators
    if (/\b(el|la|los|las|es|está|que|con|por|para|como|más|pero|muy|también|ahora|cuando|donde|quien)\b/.test(lowerText)) {
        return 'spanish';
    }
    // French indicators
    if (/\b(le|la|les|est|sont|avec|pour|dans|sur|très|mais|aussi|bien|comme|plus|cette|qui|que|où)\b/.test(lowerText)) {
        return 'french';
    }
    // German indicators
    if (/\b(der|die|das|ist|sind|mit|für|auf|sehr|aber|auch|wenn|oder|weil|dass|nicht|noch|schon)\b/.test(lowerText)) {
        return 'german';
    }
    // Portuguese indicators
    if (/\b(o|a|os|as|é|são|com|para|em|muito|mas|também|como|mais|agora|quando|onde|quem)\b/.test(lowerText)) {
        return 'portuguese';
    }
    // Italian indicators
    if (/\b(il|la|i|le|è|sono|con|per|in|molto|ma|anche|come|più|ora|quando|dove|chi)\b/.test(lowerText)) {
        return 'italian';
    }
    // Dutch indicators
    if (/\b(de|het|een|is|zijn|met|voor|op|zeer|maar|ook|als|of|omdat|niet|nog|wel)\b/.test(lowerText)) {
        return 'dutch';
    }
    // Polish indicators
    if (/\b(jest|są|z|dla|na|bardzo|ale|też|jak|więcej|teraz|kiedy|gdzie|kto|czy|nie|tak)\b/.test(lowerText)) {
        return 'polish';
    }
    // Turkish indicators
    if (/\b(bir|bu|ve|ile|için|çok|ama|da|de|gibi|daha|şimdi|ne|kim|nerede|nasıl)\b/.test(lowerText)) {
        return 'turkish';
    }

    // Default to English for Latin script
    return 'english';
}

/**
 * Generate TTS for a single chunk using Chatterbox Multilingual
 * 
 * Parameter tuning for natural voice cloning:
 * - exaggeration (0.25-2.0): Controls expressiveness. 0.5 is neutral, higher = more expressive
 * - temperature (0.05-5.0): Controls variation. Higher = more varied speech patterns
 * - cfg_scale (0.0-1.0): Guidance strength. LOWER values (0.0-0.2) work better for voice cloning
 *   as they reduce "accent inheritance" and let the voice sample shine through
 */
async function generateChatterboxTTS(
    text: string,
    voiceSampleUrl: string,
    language: ChatterboxLanguage = 'english'
): Promise<{ audioUrl: string }> {
    const result = await fal.subscribe('fal-ai/chatterbox/text-to-speech/multilingual', {
        input: {
            text,
            voice: voiceSampleUrl, // Custom audio URL for zero-shot cloning
            custom_audio_language: language,
            // Tuned parameters for natural voice cloning:
            exaggeration: 0.65,    // Slightly more expressive (was 0.5) - less robotic
            temperature: 0.7,      // Slightly lower variation (was 0.8) - more consistent
            cfg_scale: 0.15        // Much lower guidance (was 0.5) - better voice matching
        },
        logs: false
    }) as unknown as { data: { audio: { url: string } } };

    if (!result.data?.audio?.url) {
        throw new Error('No audio URL from Chatterbox TTS');
    }

    return { audioUrl: result.data.audio.url };
}

/**
 * Generate TTS for text using Chatterbox with voice cloning.
 * Handles chunking for texts > 300 chars.
 * Now with automatic language detection for better pronunciation!
 * 
 * @param text - The text to synthesize
 * @param voiceSampleUrl - URL to the voice sample for cloning
 * @param language - Language code (optional, will auto-detect if not provided)
 * @returns Audio URL and estimated duration
 */
export async function generateSceneTTS(
    text: string,
    voiceSampleUrl: string,
    language?: ChatterboxLanguage
): Promise<{ audioUrl: string; duration: number }> {
    // Auto-detect language from text if not explicitly provided
    const detectedLang = language || detectLanguage(text);

    console.log(`🎤 TTS: "${text.substring(0, 30)}..." (Voice: ${voiceSampleUrl.substring(0, 50)}..., Lang: ${detectedLang})`);

    // Use a default voice sample if none provided
    const sampleUrl = voiceSampleUrl || 'https://storage.googleapis.com/chatterbox-demo-samples/prompts/male_old_movie.flac';

    try {
        const chunks = chunkText(text);
        console.log(`📝 Text split into ${chunks.length} chunk(s)`);

        if (chunks.length === 1) {
            // Single chunk - simple case
            const result = await generateChatterboxTTS(chunks[0], sampleUrl, detectedLang);
            // Estimate duration: ~150 words per minute, avg 5 chars per word
            const estimatedDuration = (text.length / 5 / 150) * 60;
            return {
                audioUrl: result.audioUrl,
                duration: Math.max(estimatedDuration, 1)
            };
        }

        // Multiple chunks - generate each and concatenate
        const audioUrls: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
            console.log(`  Chunk ${i + 1}/${chunks.length}: "${chunks[i].substring(0, 30)}..."`);
            const result = await generateChatterboxTTS(chunks[i], sampleUrl, detectedLang);
            audioUrls.push(result.audioUrl);
        }

        // For now, return the first audio URL
        // TODO: Implement audio concatenation for multi-chunk scripts
        // This will require downloading chunks and concatenating with ffmpeg
        console.log(`⚠️ Multiple chunks generated - returning first chunk URL. Full concatenation not yet implemented.`);

        const estimatedDuration = (text.length / 5 / 150) * 60;
        return {
            audioUrl: audioUrls[0],
            duration: Math.max(estimatedDuration, 1)
        };

    } catch (error) {
        console.error("TTS Generation Error:", error);
        throw error;
    }
}

/**
 * Generate image using Flux
 */
export async function generateImage(prompt: string, aspectRatio: "16:9" | "9:16" | "1:1" = "9:16"): Promise<string> {
    console.log(`🎨 Generating Image: "${prompt.substring(0, 30)}..." (${aspectRatio})`);

    // Map aspect ratio to image size
    const image_size = aspectRatio === '16:9' ? 'landscape_16_9'
        : aspectRatio === '9:16' ? 'portrait_16_9'
            : 'square_hd';

    try {
        const result = await fal.subscribe('fal-ai/flux/dev', {
            input: {
                prompt,
                image_size,
                num_inference_steps: 30,
                guidance_scale: 3.5,
                enable_safety_checker: false
            },
            logs: false
        }) as unknown as { images: { url: string }[] };

        if (!result.images?.[0]?.url) throw new Error('No image URL from Flux');
        return result.images[0].url;
    } catch (error) {
        console.error("Image Generation Error:", error);
        throw error;
    }
}
