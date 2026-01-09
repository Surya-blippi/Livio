import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export interface CaptionWord {
    word: string;
    startFrame: number;
    endFrame: number;
}

interface CaptionsProps {
    words: CaptionWord[];
    wordsPerPhrase?: number;
    style?: 'bold-classic' | 'modern-pop' | 'minimal' | 'vibrant';
}

// Group words into phrases
function groupWordsIntoPhrases(words: CaptionWord[], wordsPerPhrase: number): {
    text: string;
    startFrame: number;
    endFrame: number;
}[] {
    const phrases: { text: string; startFrame: number; endFrame: number }[] = [];

    for (let i = 0; i < words.length; i += wordsPerPhrase) {
        const phraseWords = words.slice(i, i + wordsPerPhrase);
        if (phraseWords.length > 0) {
            phrases.push({
                text: phraseWords.map(w => w.word).join(' '),
                startFrame: phraseWords[0].startFrame,
                endFrame: phraseWords[phraseWords.length - 1].endFrame
            });
        }
    }

    return phrases;
}

// Style definitions
const styles = {
    'bold-classic': {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: 64,
        color: '#FFFFFF',
        textShadow: '3px 3px 6px rgba(0,0,0,0.8), -2px -2px 4px rgba(0,0,0,0.5)',
        letterSpacing: 2
    },
    'modern-pop': {
        fontFamily: 'Inter, Helvetica, sans-serif',
        fontSize: 56,
        color: '#FFFFFF',
        textShadow: '0 4px 12px rgba(0,0,0,0.6)',
        letterSpacing: 1,
        fontWeight: 800
    },
    'minimal': {
        fontFamily: 'Georgia, serif',
        fontSize: 48,
        color: '#FFFFFF',
        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
        letterSpacing: 0
    },
    'vibrant': {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: 60,
        color: '#FFD700',
        textShadow: '3px 3px 0 #FF4500, 6px 6px 8px rgba(0,0,0,0.7)',
        letterSpacing: 3
    }
};

export const Captions: React.FC<CaptionsProps> = ({
    words,
    wordsPerPhrase = 4,
    style = 'bold-classic'
}) => {
    const frame = useCurrentFrame();
    const phrases = groupWordsIntoPhrases(words, wordsPerPhrase);
    const captionStyle = styles[style] || styles['bold-classic'];

    // Find current phrase
    const currentPhrase = phrases.find(
        p => frame >= p.startFrame && frame < p.endFrame
    );

    if (!currentPhrase) {
        return null;
    }

    // Calculate animation progress within this phrase
    const phraseProgress = interpolate(
        frame,
        [currentPhrase.startFrame, currentPhrase.startFrame + 5],
        [0, 1],
        { extrapolateRight: 'clamp' }
    );

    // Pop-in animation
    const scale = interpolate(phraseProgress, [0, 1], [0.8, 1]);
    const opacity = interpolate(phraseProgress, [0, 1], [0, 1]);

    return (
        <AbsoluteFill
            style={{
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingBottom: 150
            }}
        >
            <div
                style={{
                    ...captionStyle,
                    textAlign: 'center',
                    maxWidth: '90%',
                    transform: `scale(${scale})`,
                    opacity,
                    WebkitTextStroke: '2px black',
                    paintOrder: 'stroke fill'
                }}
            >
                {currentPhrase.text}
            </div>
        </AbsoluteFill>
    );
};
