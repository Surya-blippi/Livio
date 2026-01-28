import React from 'react';
import { AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Clean, solid background colors (no gradients)
const SOLID_COLORS = [
    '#1A1A2E', // Deep Navy
    '#16213E', // Dark Blue
    '#0F3460', // Royal Blue
    '#533483', // Deep Purple
    '#E94560', // Vibrant Pink
    '#0D7377', // Teal
    '#14274E', // Night Blue
    '#2C3333', // Charcoal
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

// Single, polished word animation component
const AnimatedWord: React.FC<{
    word: string;
    isActive: boolean;
    relativeFrame: number;
    fps: number;
}> = ({ word, isActive, relativeFrame, fps }) => {

    // Snappy spring config for professional pop-in
    const scaleSpring = spring({
        frame: relativeFrame,
        fps,
        config: {
            stiffness: 220,   // Very snappy
            damping: 16,      // Minimal bounce
        },
        durationInFrames: 6,  // Ultra-fast entrance
    });

    // Clean scale animation: 0 -> 1.05 -> 1 (tiny overshoot)
    const scale = interpolate(scaleSpring, [0, 0.8, 1], [0.3, 1.05, 1], {
        extrapolateRight: 'clamp',
    });

    // Subtle slide up: 15px -> 0px
    const translateY = interpolate(scaleSpring, [0, 1], [15, 0], {
        extrapolateRight: 'clamp',
    });

    // Opacity: instant full visibility, dim when passed
    const opacity = isActive ? 1 : 0.5;

    return (
        <span
            style={{
                display: 'inline-block',
                opacity,
                transform: `translateY(${translateY}px) scale(${scale})`,
                transformOrigin: 'center center',
                color: '#FFFFFF',
                textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 800,
                fontSize: '90px',
                textTransform: 'uppercase',
                letterSpacing: '2px',
            }}
        >
            {word}
        </span>
    );
};

export const TypographyComposition: React.FC<TypographyCompositionProps> = ({
    audioUrl,
    words,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Find current word (ONE word at a time for perfect sync)
    let currentWordIndex = 0;
    if (words && words.length > 0) {
        for (let i = 0; i < words.length; i++) {
            if (frame >= words[i].startFrame) {
                currentWordIndex = i;
            }
        }
    }

    const currentWord = words[currentWordIndex];

    // Background color changes every few words for variety
    const colorIndex = Math.floor(currentWordIndex / 3) % SOLID_COLORS.length;
    const backgroundColor = SOLID_COLORS[colorIndex];

    // Calculate relative frame for animation
    const hasStarted = currentWord && frame >= currentWord.startFrame;
    const isActive = hasStarted && frame < currentWord.endFrame;
    const relativeFrame = hasStarted ? frame - currentWord.startFrame : 0;

    return (
        <AbsoluteFill>
            {/* Load Google Font */}
            <style>
                {`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@800&display=swap');`}
            </style>

            {/* Solid Color Background */}
            <AbsoluteFill
                style={{
                    backgroundColor,
                    transition: 'background-color 0.3s ease',
                }}
            />

            {/* Audio */}
            <Audio src={audioUrl} />

            {/* Single Word - Centered */}
            <AbsoluteFill
                style={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '60px',
                }}
            >
                {hasStarted && currentWord && (
                    <AnimatedWord
                        word={currentWord.text}
                        isActive={isActive}
                        relativeFrame={relativeFrame}
                        fps={fps}
                    />
                )}
            </AbsoluteFill>

            {/* Minimal Progress Bar */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '4px',
                backgroundColor: '#FFFFFF',
                width: `${(frame / ((words && words.length > 0) ? (words[words.length - 1]?.endFrame ?? 1) : 1)) * 100}%`,
                opacity: 0.7,
            }} />

        </AbsoluteFill>
    );
};
