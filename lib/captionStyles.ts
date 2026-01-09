/**
 * Caption Style Definitions
 * 
 * Each style defines font, colors (in ASS BGR format), and animation effects.
 * These are used by the video rendering API to generate styled captions.
 */

export interface CaptionStyle {
    id: string;
    name: string;
    description: string;
    font: string;
    fontFallback: string;
    fontSize: number;
    // Colors in ASS format: &HAABBGGRR (Alpha, Blue, Green, Red)
    primaryColor: string;      // Main text color
    outlineColor: string;      // Outline/border color
    shadowColor: string;       // Shadow/back color
    outlineWidth: number;
    shadowDepth: number;
    bold: boolean;
    // Animation effects
    animation: 'pop' | 'fade' | 'bounce' | 'glow' | 'slide' | 'none';
    // Preview CSS (for UI rendering)
    previewCss: {
        fontFamily: string;
        color: string;
        textShadow: string;
        fontWeight: string;
    };
}

export const CAPTION_STYLES: CaptionStyle[] = [
    {
        id: 'bold-classic',
        name: 'Bold Classic',
        description: 'Clean, professional white text',
        font: 'Impact',
        fontFallback: 'Arial Black, sans-serif',
        fontSize: 72,
        primaryColor: '&H00FFFFFF',  // White
        outlineColor: '&H00000000',  // Black outline
        shadowColor: '&H80000000',   // Semi-transparent black
        outlineWidth: 4,
        shadowDepth: 2,
        bold: true,
        animation: 'pop',
        previewCss: {
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: '#FFFFFF',
            textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
            fontWeight: 'bold',
        },
    },
    {
        id: 'neon-glow',
        name: 'Neon Glow',
        description: 'Vibrant cyan with glow effect',
        font: 'Arial Black',
        fontFallback: 'Arial, sans-serif',
        fontSize: 68,
        primaryColor: '&H00FFFF00',  // Cyan (BGR)
        outlineColor: '&H00FF8800',  // Darker cyan
        shadowColor: '&H8000FFFF',   // Cyan glow
        outlineWidth: 2,
        shadowDepth: 8,
        bold: true,
        animation: 'glow',
        previewCss: {
            fontFamily: 'Arial Black, Arial, sans-serif',
            color: '#00FFFF',
            textShadow: '0 0 10px #00FFFF, 0 0 20px #00FFFF, 0 0 30px #0088FF',
            fontWeight: 'bold',
        },
    },
    {
        id: 'minimal',
        name: 'Minimal',
        description: 'Subtle and clean look',
        font: 'Inter',
        fontFallback: 'Helvetica Neue, Arial, sans-serif',
        fontSize: 56,
        primaryColor: '&H00FFFFFF',  // White
        outlineColor: '&H40000000',  // Very subtle outline
        shadowColor: '&H60000000',   // Soft shadow
        outlineWidth: 1,
        shadowDepth: 3,
        bold: false,
        animation: 'fade',
        previewCss: {
            fontFamily: 'Inter, Helvetica Neue, Arial, sans-serif',
            color: '#FFFFFF',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            fontWeight: '500',
        },
    },
    {
        id: 'handwritten',
        name: 'Handwritten',
        description: 'Playful, personal feel',
        font: 'Birds of Paradise  Personal use',
        fontFallback: 'Comic Sans MS, cursive',
        fontSize: 80,
        primaryColor: '&H00FFFFFF',  // White
        outlineColor: '&H00000000',  // Black outline
        shadowColor: '&H80000000',   // Shadow
        outlineWidth: 3,
        shadowDepth: 2,
        bold: false,
        animation: 'bounce',
        previewCss: {
            fontFamily: '"Birds of Paradise", "Comic Sans MS", cursive',
            color: '#FFFFFF',
            textShadow: '2px 2px 0 #000',
            fontWeight: 'normal',
        },
    },
    {
        id: 'retro-vhs',
        name: 'Retro VHS',
        description: 'Nostalgic 80s style',
        font: 'VCR OSD Mono',
        fontFallback: 'Courier New, monospace',
        fontSize: 60,
        primaryColor: '&H0000FFFF',  // Yellow (BGR)
        outlineColor: '&H000066FF',  // Orange outline
        shadowColor: '&H80000088',   // Red tint shadow
        outlineWidth: 2,
        shadowDepth: 3,
        bold: false,
        animation: 'none',
        previewCss: {
            fontFamily: '"VCR OSD Mono", "Courier New", monospace',
            color: '#FFFF00',
            textShadow: '2px 2px 0 #FF6600, -1px -1px 0 rgba(255,0,0,0.5)',
            fontWeight: 'normal',
        },
    },
    {
        id: 'gradient-pop',
        name: 'Gradient Pop',
        description: 'Trendy TikTok style',
        font: 'Poppins',
        fontFallback: 'Arial, sans-serif',
        fontSize: 64,
        primaryColor: '&H00FF88FF',  // Pink (will use gradient override)
        outlineColor: '&H00000000',  // Black
        shadowColor: '&H80000000',   // Shadow
        outlineWidth: 3,
        shadowDepth: 2,
        bold: true,
        animation: 'pop',
        previewCss: {
            fontFamily: 'Poppins, Arial, sans-serif',
            color: '#FF88FF',
            textShadow: '2px 2px 0 #000',
            fontWeight: 'bold',
        },
    },
];

// Get style by ID
export function getCaptionStyle(id: string): CaptionStyle {
    return CAPTION_STYLES.find(s => s.id === id) || CAPTION_STYLES[0];
}

// Default style
export const DEFAULT_CAPTION_STYLE = 'bold-classic';
