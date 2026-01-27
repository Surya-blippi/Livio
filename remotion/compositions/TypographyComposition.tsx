import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig, random } from 'remotion';

// Colorful gradients for typography mode
const GRADIENTS = [
    'linear-gradient(135deg, #FF6B6B 0%, #C44D56 100%)', // Coral
    'linear-gradient(135deg, #4ECDC4 0%, #2980B9 100%)', // Sea Blue
    'linear-gradient(135deg, #8E44AD 0%, #3498DB 100%)', // Purple Rain
    'linear-gradient(135deg, #F1C40F 0%, #E67E22 100%)', // Sunburst
    'linear-gradient(135deg, #2ECC71 0%, #16A085 100%)', // Emerald
    'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)', // Crimson
    'linear-gradient(135deg, #9B59B6 0%, #8E44AD 100%)', // Amethyst
    'linear-gradient(135deg, #34495E 0%, #2C3E50 100%)', // Midnight
];

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
    isActive: boolean;
    hasPassed: boolean;
    frame: number;
    fps: number;
}> = ({ word, isActive, hasPassed, frame, fps }) => {
    // Simple linear pop-in (cheaper than spring)
    const activeScale = interpolate(frame, [0, 5], [0.9, 1.1], { extrapolateRight: 'clamp' });
    const inactiveScale = 1.0;

    // Simple colors (no heavy shadows)
    const color = isActive ? '#FFE66D' : '#FFFFFF';
    const opacity = isActive ? 1 : (hasPassed ? 0.6 : 0.8);

    // Static shadow for readability, not dynamic
    const textShadow = '2px 2px 0px rgba(0,0,0,0.3)';

    return (
        <span
            style={{
                display: 'inline-block',
                opacity,
                transform: `scale(${isActive ? activeScale : inactiveScale})`,
                color,
                textShadow,
                fontFamily: "'Anton', sans-serif",
                margin: '0 10px',
                // Use CSS transition for smooth color even if frames skip
                transition: 'color 0.2s, transform 0.2s',
                zIndex: isActive ? 10 : 1,
                position: 'relative'
            }}
        >
            {word}
        </span>
    );
};

export const TypographyComposition: React.FC<TypographyCompositionProps> = ({
    audioUrl,
    words,
    wordsPerGroup = 3,
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    // Group words
    const wordGroups = useMemo(() => {
        const groups: TypographyWord[][] = [];
        for (let i = 0; i < words.length; i += wordsPerGroup) {
            groups.push(words.slice(i, i + wordsPerGroup));
        }
        return groups;
    }, [words, wordsPerGroup]);

    // Determine current group
    let currentGroupIndex = 0;
    for (let i = 0; i < wordGroups.length; i++) {
        const group = wordGroups[i];
        if (frame >= (group[0]?.startFrame ?? 0)) {
            currentGroupIndex = i;
        }
    }

    // Safety check
    const currentGroup = wordGroups[currentGroupIndex] || [];

    // Dynamic Gradient Background
    const gradientIndex = currentGroupIndex % GRADIENTS.length;
    const currentGradient = GRADIENTS[gradientIndex];
    // Slower, simpler gradient movement
    const gradientPos = (frame / 5) % 100;

    return (
        <AbsoluteFill>
            {/* Load Google Font */}
            <style>
                {`@import url('https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@800&display=swap');`}
            </style>

            {/* Background - Removed Noise Filter for Performance */}
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
                        gap: '20px',
                        maxWidth: '90%',
                        // Removed container scaling to save layout recalculations
                    }}
                >
                    {currentGroup.map((wordData, idx) => {
                        const isWordActive = frame >= wordData.startFrame && frame < wordData.endFrame;
                        const hasWordPassed = frame >= wordData.endFrame;
                        const relativeFrame = Math.max(0, frame - wordData.startFrame);

                        return (
                            <AnimatedWord
                                key={`${currentGroupIndex}-${idx}`}
                                word={wordData.text}
                                isActive={isWordActive}
                                hasPassed={hasWordPassed}
                                frame={relativeFrame}
                                fps={fps}
                            />
                        );
                    })}
                </div>
            </AbsoluteFill>

            {/* Progress Bar (Optional, looks nice on reels) */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '8px',
                backgroundColor: '#FFE66D',
                width: `${(frame / (words[words.length - 1]?.endFrame ?? 1)) * 100}%`,
                zIndex: 100
            }} />

        </AbsoluteFill>
    );
};
