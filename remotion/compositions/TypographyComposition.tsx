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

// Spring config for snappy, bouncy feel
const SPRING_CONFIG = {
    stiffness: 150,
    damping: 12,
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
    relativeFrame: number; // Frame relative to this word's start
    fps: number;
}> = ({ word, isActive, hasPassed, relativeFrame, fps }) => {
    // Spring-based scale animation (starts at 0, springs to 1)
    const scaleSpring = spring({
        frame: relativeFrame,
        fps,
        config: SPRING_CONFIG,
        durationInFrames: 15, // Quick but bouncy
    });

    // "Squash" effect: scaleY slightly taller during the spring overshoot
    // Interpolate based on the spring value: 0 -> 1.15 -> 1.0 (taller before settling)
    const scaleY = interpolate(scaleSpring, [0, 0.5, 1], [0, 1.15, 1], { extrapolateRight: 'clamp' });
    const scaleX = interpolate(scaleSpring, [0, 0.5, 1], [0, 0.9, 1], { extrapolateRight: 'clamp' });

    // Translate Y: Slide up from 30px to 0px during the entrance
    const translateY = interpolate(relativeFrame, [0, 10], [30, 0], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
    });

    // Opacity: Fade in quickly, then stay visible. Dim past words slightly.
    const opacity = isActive ? 1 : hasPassed ? 0.7 : scaleSpring; // Dim past, fade in current

    return (
        <span
            style={{
                display: 'inline-block',
                opacity,
                transform: `translateY(${translateY}px) scaleX(${scaleX}) scaleY(${scaleY})`,
                transformOrigin: 'center bottom', // Bounce from the bottom
                color: '#FFFFFF',
                textShadow: '3px 3px 6px rgba(0,0,0,0.6)', // Deeper shadow for pop
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
    // Slow gradient movement for subtle visual interest
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
                        alignItems: 'flex-end', // Anchor to bottom for squash effect
                        gap: '20px',
                        maxWidth: '90%',
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
