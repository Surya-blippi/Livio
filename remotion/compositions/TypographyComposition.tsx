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
    // Current word pops in
    const scale = spring({
        frame: isActive ? frame : 0,
        fps,
        config: { damping: 12, stiffness: 200, mass: 0.5 },
    });

    // Style calculation
    const activeScale = interpolate(scale, [0, 1], [0.8, 1.2]);
    const inactiveScale = 1.0;

    // Color transition
    const color = isActive ? '#FFE66D' : (hasPassed ? '#FFFFFF' : '#FFFFFF');
    // Opacity: Past words dim slightly, future words are visible
    const opacity = isActive ? 1 : (hasPassed ? 0.6 : 0.8);
    // Text Shadow: Stronger for active word
    const textShadow = isActive
        ? '0px 0px 20px rgba(255, 230, 109, 0.6), 4px 4px 0px rgba(0,0,0,0.5)'
        : '2px 2px 0px rgba(0,0,0,0.3)';

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
                transition: 'color 0.1s, transform 0.1s, opacity 0.2s',
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
    // We can interpret a slow rotation of the hue or gradient position
    const gradientPos = (frame / 2) % 100;

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
            >
                {/* Noise Texture Overlay for "Reel" feel */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.1,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }} />
            </AbsoluteFill>

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
                        transform: `scale(${interpolate(currentGroupIndex % 2, [0, 1], [1, 1.05])})`, // Subtle alternating scale per group
                        transition: 'transform 0.3s ease'
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
