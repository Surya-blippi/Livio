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
    'linear-gradient(135deg, #34495E 0%, #2C3E50 100%)', // Midnight
];

// Faster spring config for snappy entrance (no delay in visibility)
const SPRING_CONFIG = {
    stiffness: 200,
    damping: 14,
};

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
    hasStarted: boolean; // TRUE only when frame >= startFrame
    relativeFrame: number;
    fps: number;
}> = ({ word, isActive, hasPassed, hasStarted, relativeFrame, fps }) => {

    // CRITICAL: Word is completely invisible until its startFrame
    // This ensures EXACT sync with audio
    if (!hasStarted) {
        return null; // Don't render anything before the word is spoken
    }

    // Fast spring for subtle bounce AFTER word appears
    const scaleSpring = spring({
        frame: relativeFrame,
        fps,
        config: SPRING_CONFIG,
        durationInFrames: 8, // Very quick settle
    });

    // Subtle squash effect (less extreme for faster animation)
    const scaleY = interpolate(scaleSpring, [0, 0.5, 1], [0.8, 1.08, 1], { extrapolateRight: 'clamp' });
    const scaleX = interpolate(scaleSpring, [0, 0.5, 1], [1.1, 0.95, 1], { extrapolateRight: 'clamp' });

    // Quick slide up (from 15px, not 30px - faster)
    const translateY = interpolate(relativeFrame, [0, 6], [15, 0], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
    });

    // Opacity: INSTANT visibility at startFrame, then dim slightly when passed
    const opacity = isActive ? 1 : hasPassed ? 0.65 : 1;

    return (
        <span
            style={{
                display: 'inline-block',
                opacity,
                transform: `translateY(${translateY}px) scaleX(${scaleX}) scaleY(${scaleY})`,
                transformOrigin: 'center bottom',
                color: '#FFFFFF',
                textShadow: '3px 3px 6px rgba(0,0,0,0.6)',
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 800,
                fontSize: '80px',
                margin: '0 12px',
                zIndex: isActive ? 10 : 1,
                position: 'relative',
            }}
        >
            {word}
        </span>
    );
};

export const TypographyComposition: React.FC<TypographyCompositionProps> = ({
    audioUrl,
    words,
    wordsPerGroup = 1, // Single word display for accurate sync
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

    // Determine current group based on the LAST word of the previous group ending
    // This ensures we don't switch groups while words are still being spoken
    let currentGroupIndex = 0;
    for (let i = 0; i < wordGroups.length; i++) {
        const group = wordGroups[i];
        const firstWordStart = group[0]?.startFrame ?? 0;
        if (frame >= firstWordStart) {
            currentGroupIndex = i;
        }
    }

    // Safety check
    const currentGroup = wordGroups[currentGroupIndex] || [];

    // Dynamic Gradient Background
    const gradientIndex = currentGroupIndex % GRADIENTS.length;
    const currentGradient = GRADIENTS[gradientIndex];
    const gradientPos = (frame / 5) % 100;

    return (
        <AbsoluteFill>
            {/* Load Google Font */}
            <style>
                {`@import url('https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@800&display=swap');`}
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
                        alignItems: 'flex-end',
                        gap: '20px',
                        maxWidth: '90%',
                    }}
                >
                    {currentGroup.map((wordData, idx) => {
                        const hasStarted = frame >= wordData.startFrame; // EXACT sync check
                        const isWordActive = hasStarted && frame < wordData.endFrame;
                        const hasWordPassed = frame >= wordData.endFrame;
                        const relativeFrame = Math.max(0, frame - wordData.startFrame);

                        return (
                            <AnimatedWord
                                key={`${currentGroupIndex}-${idx}`}
                                word={wordData.text}
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
                height: '8px',
                backgroundColor: '#FFE66D',
                width: `${(frame / (words[words.length - 1]?.endFrame ?? 1)) * 100}%`,
                zIndex: 100
            }} />

        </AbsoluteFill>
    );
};
