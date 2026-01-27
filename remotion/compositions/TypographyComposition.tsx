import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

// Colorful gradients for typography mode
const GRADIENTS = [
    'linear-gradient(135deg, #FF6B6B 0%, #C44D56 100%)', // Coral
    'linear-gradient(135deg, #4ECDC4 0%, #2980B9 100%)', // Sea Blue
    'linear-gradient(135deg, #8E44AD 0%, #3498DB 100%)', // Purple Rain
    'linear-gradient(135deg, #F1C40F 0%, #E67E22 100%)', // Sunburst
    'linear-gradient(135deg, #2ECC71 0%, #16A085 100%)', // Emerald
    'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)', // Crimson
    'linear-gradient(135deg, #9B59B6 0%, #8E44AD 100%)', // Amethyst
    'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)', // Deep Night
];

// Animation styles for variety
type AnimationStyle = 'pop' | 'slideLeft' | 'slideRight' | 'zoom' | 'rotate' | 'drop';
const ANIMATION_STYLES: AnimationStyle[] = ['pop', 'slideLeft', 'slideRight', 'zoom', 'rotate', 'drop'];

// Font sizes for visual hierarchy
const FONT_SIZES = {
    small: 60,
    medium: 80,
    large: 110,
    xlarge: 140,
};

// Simple hash function to deterministically vary styles per word
function hashWord(word: string, index: number): number {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash + index);
}

// Keywords that should be emphasized (larger, different color)
const EMPHASIS_WORDS = ['you', 'ai', 'love', 'hate', 'best', 'worst', 'free', 'money', 'secret', 'amazing', 'incredible', 'powerful', 'easy', 'fast', 'new', 'now', 'today', 'never', 'always', 'stop', 'start', 'why', 'how', 'what', 'who', 'when', 'where'];

function isEmphasisWord(word: string): boolean {
    return EMPHASIS_WORDS.includes(word.toLowerCase().replace(/[^a-z]/g, ''));
}

export interface TypographyWord {
    text: string;
    startFrame: number;
    endFrame: number;
}

export interface TypographyCompositionProps {
    audioUrl: string;
    words: TypographyWord[];
    wordsPerGroup?: number;
    animationStyle?: 'pop' | 'slide' | 'fade' | 'typewriter';
}

const AnimatedWord: React.FC<{
    word: string;
    wordIndex: number;
    isActive: boolean;
    hasPassed: boolean;
    hasStarted: boolean;
    relativeFrame: number;
    fps: number;
}> = ({ word, wordIndex, isActive, hasPassed, hasStarted, relativeFrame, fps }) => {

    if (!hasStarted) {
        return null;
    }

    // Deterministic variety based on word content and index
    const hash = hashWord(word, wordIndex);
    const animStyle = ANIMATION_STYLES[hash % ANIMATION_STYLES.length];
    const isEmphasis = isEmphasisWord(word);

    // Font size: emphasis words are large, others vary
    let fontSize: number;
    if (isEmphasis) {
        fontSize = FONT_SIZES.xlarge;
    } else {
        const sizeOptions = [FONT_SIZES.small, FONT_SIZES.medium, FONT_SIZES.large];
        fontSize = sizeOptions[hash % sizeOptions.length];
    }

    // Spring config varies by animation
    const springConfig = {
        stiffness: isEmphasis ? 180 : 200,
        damping: isEmphasis ? 10 : 14
    };

    const scaleSpring = spring({
        frame: relativeFrame,
        fps,
        config: springConfig,
        durationInFrames: isEmphasis ? 12 : 8,
    });

    // Calculate animation transforms based on style
    let transform = '';
    let initialOpacity = 1;

    switch (animStyle) {
        case 'pop': {
            const scaleY = interpolate(scaleSpring, [0, 0.5, 1], [0.3, 1.15, 1], { extrapolateRight: 'clamp' });
            const scaleX = interpolate(scaleSpring, [0, 0.5, 1], [1.2, 0.9, 1], { extrapolateRight: 'clamp' });
            const translateY = interpolate(relativeFrame, [0, 6], [20, 0], { extrapolateRight: 'clamp' });
            transform = `translateY(${translateY}px) scaleX(${scaleX}) scaleY(${scaleY})`;
            break;
        }
        case 'slideLeft': {
            const translateX = interpolate(scaleSpring, [0, 1], [100, 0], { extrapolateRight: 'clamp' });
            const scale = interpolate(scaleSpring, [0, 1], [0.8, 1], { extrapolateRight: 'clamp' });
            transform = `translateX(${translateX}px) scale(${scale})`;
            break;
        }
        case 'slideRight': {
            const translateX = interpolate(scaleSpring, [0, 1], [-100, 0], { extrapolateRight: 'clamp' });
            const scale = interpolate(scaleSpring, [0, 1], [0.8, 1], { extrapolateRight: 'clamp' });
            transform = `translateX(${translateX}px) scale(${scale})`;
            break;
        }
        case 'zoom': {
            const scale = interpolate(scaleSpring, [0, 0.6, 1], [2.5, 0.9, 1], { extrapolateRight: 'clamp' });
            transform = `scale(${scale})`;
            initialOpacity = interpolate(scaleSpring, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' });
            break;
        }
        case 'rotate': {
            const rotate = interpolate(scaleSpring, [0, 1], [-15, 0], { extrapolateRight: 'clamp' });
            const scale = interpolate(scaleSpring, [0, 1], [0.5, 1], { extrapolateRight: 'clamp' });
            const translateY = interpolate(scaleSpring, [0, 1], [30, 0], { extrapolateRight: 'clamp' });
            transform = `translateY(${translateY}px) rotate(${rotate}deg) scale(${scale})`;
            break;
        }
        case 'drop': {
            const translateY = interpolate(scaleSpring, [0, 0.7, 1], [-80, 5, 0], { extrapolateRight: 'clamp' });
            const scale = interpolate(scaleSpring, [0, 0.7, 1], [0.5, 1.1, 1], { extrapolateRight: 'clamp' });
            transform = `translateY(${translateY}px) scale(${scale})`;
            break;
        }
    }

    // Opacity: active = full, passed = slightly dimmed
    const opacity = (isActive ? 1 : hasPassed ? 0.6 : 1) * initialOpacity;

    // Color: emphasis words get accent color
    const color = isEmphasis ? '#FFE66D' : '#FFFFFF';
    const textShadow = isEmphasis
        ? '4px 4px 8px rgba(0,0,0,0.8), 0 0 30px rgba(255,230,109,0.3)'
        : '3px 3px 6px rgba(0,0,0,0.6)';

    return (
        <span
            style={{
                display: 'inline-block',
                opacity,
                transform,
                transformOrigin: 'center center',
                color,
                textShadow,
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: isEmphasis ? 900 : 800,
                fontSize: `${fontSize}px`,
                margin: '0 12px',
                zIndex: isActive ? 10 : 1,
                position: 'relative',
                textTransform: isEmphasis ? 'uppercase' : 'none',
            }}
        >
            {word}
        </span>
    );
};

export const TypographyComposition: React.FC<TypographyCompositionProps> = ({
    audioUrl,
    words,
    wordsPerGroup = 1, // Default to single word for sync, but can vary
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    // Dynamic grouping: vary between 1-3 words based on word lengths
    const wordGroups = useMemo(() => {
        const groups: TypographyWord[][] = [];
        let i = 0;
        while (i < words.length) {
            // Determine group size based on word length
            const word = words[i];
            const wordLen = word.text.length;

            // Short words (1-4 chars) can be grouped with next words
            // Long words (8+ chars) stand alone
            let groupSize = 1;
            if (wordLen <= 3 && i + 1 < words.length) {
                // Short word - maybe group with next
                const nextWord = words[i + 1];
                if (nextWord && nextWord.text.length <= 4) {
                    groupSize = 2; // Group two short words together
                    // Check for third
                    if (i + 2 < words.length && words[i + 2].text.length <= 3) {
                        groupSize = 3;
                    }
                }
            } else if (isEmphasisWord(word.text)) {
                groupSize = 1; // Emphasis words always alone for impact
            }

            groups.push(words.slice(i, i + groupSize));
            i += groupSize;
        }
        return groups;
    }, [words]);

    // Find current group
    let currentGroupIndex = 0;
    for (let i = 0; i < wordGroups.length; i++) {
        const group = wordGroups[i];
        if (frame >= (group[0]?.startFrame ?? 0)) {
            currentGroupIndex = i;
        }
    }

    const currentGroup = wordGroups[currentGroupIndex] || [];

    // Background gradient changes per group
    const gradientIndex = currentGroupIndex % GRADIENTS.length;
    const currentGradient = GRADIENTS[gradientIndex];
    const gradientPos = (frame / 5) % 100;

    // Calculate global word index for consistent styling
    let globalWordOffset = 0;
    for (let i = 0; i < currentGroupIndex; i++) {
        globalWordOffset += wordGroups[i].length;
    }

    return (
        <AbsoluteFill>
            <style>
                {`@import url('https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@800;900&display=swap');`}
            </style>

            {/* Background */}
            <AbsoluteFill
                style={{
                    background: currentGradient,
                    backgroundSize: '200% 200%',
                    backgroundPosition: `${gradientPos}% 50%`,
                    transition: 'background 0.5s ease',
                }}
            />

            {/* Audio */}
            <Audio src={audioUrl} />

            {/* Text Container */}
            <AbsoluteFill
                style={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '40px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '15px',
                        maxWidth: '90%',
                        textAlign: 'center',
                    }}
                >
                    {currentGroup.map((wordData, idx) => {
                        const globalIdx = globalWordOffset + idx;
                        const hasStarted = frame >= wordData.startFrame;
                        const isWordActive = hasStarted && frame < wordData.endFrame;
                        const hasWordPassed = frame >= wordData.endFrame;
                        const relativeFrame = Math.max(0, frame - wordData.startFrame);

                        return (
                            <AnimatedWord
                                key={`${currentGroupIndex}-${idx}`}
                                word={wordData.text}
                                wordIndex={globalIdx}
                                isActive={isWordActive}
                                hasPassed={hasWordPassed}
                                hasStarted={hasStarted}
                                relativeFrame={relativeFrame}
                                fps={fps}
                            />
                        );
                    })}
                </div>
            </AbsoluteFill>

            {/* Progress Bar */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '6px',
                background: 'linear-gradient(90deg, #FFE66D, #FF6B6B)',
                width: `${(frame / (words[words.length - 1]?.endFrame ?? 1)) * 100}%`,
                zIndex: 100,
                boxShadow: '0 0 10px rgba(255,230,109,0.5)',
            }} />

        </AbsoluteFill>
    );
};
