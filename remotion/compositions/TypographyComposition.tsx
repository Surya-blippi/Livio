import React from 'react';
import { AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Colorful backgrounds for typography mode
const TYPOGRAPHY_COLORS = [
    '#FF6B6B', // Coral Red
    '#4ECDC4', // Teal
    '#45B7D1', // Sky Blue
    '#96CEB4', // Sage Green
    '#FFEAA7', // Soft Yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Mint
    '#F7DC6F', // Golden
    '#BB8FCE', // Lavender
    '#85C1E9', // Light Blue
];

export interface TypographyWord {
    text: string;
    startFrame: number;
    endFrame: number;
}

export interface TypographyCompositionProps {
    audioUrl: string;
    words: TypographyWord[];
    wordsPerGroup?: number; // How many words to show at once
    animationStyle?: 'pop' | 'slide' | 'fade' | 'typewriter';
}

// Individual word component with animation
const AnimatedWord: React.FC<{
    word: string;
    isActive: boolean;
    animationStyle: string;
    frame: number;
    fps: number;
}> = ({ word, isActive, animationStyle, frame, fps }) => {
    // Spring animation for pop effect
    const popScale = spring({
        frame: isActive ? frame : 0,
        fps,
        config: {
            damping: 10,
            stiffness: 100,
            mass: 0.5,
        },
    });

    const opacity = isActive ? 1 : 0;
    let transform = '';

    switch (animationStyle) {
        case 'pop':
            transform = `scale(${interpolate(popScale, [0, 1], [0.5, 1])})`;
            break;
        case 'slide':
            transform = `translateY(${isActive ? 0 : 50}px)`;
            break;
        case 'typewriter':
            transform = 'none';
            break;
        case 'fade':
        default:
            transform = 'none';
    }

    return (
        <span
            style={{
                display: 'inline-block',
                opacity,
                transform,
                transition: 'opacity 0.15s ease, transform 0.15s ease',
                margin: '0 12px',
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
    animationStyle = 'pop',
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Group words for display (show wordsPerGroup at a time)
    const wordGroups: TypographyWord[][] = [];
    for (let i = 0; i < words.length; i += wordsPerGroup) {
        wordGroups.push(words.slice(i, i + wordsPerGroup));
    }

    // Find current group based on frame
    let currentGroupIndex = 0;
    for (let i = 0; i < wordGroups.length; i++) {
        const group = wordGroups[i];
        const groupStart = group[0]?.startFrame ?? 0;
        const groupEnd = group[group.length - 1]?.endFrame ?? 0;
        if (frame >= groupStart && frame <= groupEnd) {
            currentGroupIndex = i;
            break;
        }
        if (frame < groupStart) {
            currentGroupIndex = Math.max(0, i - 1);
            break;
        }
        currentGroupIndex = i;
    }

    // Get current group's text
    const currentGroup = wordGroups[currentGroupIndex] || [];
    const currentText = currentGroup.map(w => w.text).join(' ');

    // Cycle through background colors based on group index
    const colorIndex = currentGroupIndex % TYPOGRAPHY_COLORS.length;
    const backgroundColor = TYPOGRAPHY_COLORS[colorIndex];

    // Calculate opacity for smooth transition
    const groupStart = currentGroup[0]?.startFrame ?? 0;
    const fadeInDuration = 5; // frames
    const fadeProgress = interpolate(
        frame,
        [groupStart, groupStart + fadeInDuration],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return (
        <AbsoluteFill
            style={{
                backgroundColor,
                transition: 'background-color 0.3s ease',
            }}
        >
            {/* Audio */}
            <Audio src={audioUrl} />

            {/* Main text container */}
            <AbsoluteFill
                style={{
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '60px',
                }}
            >
                <div
                    style={{
                        fontFamily: 'Inter, Arial Black, sans-serif',
                        fontSize: 90,
                        fontWeight: 900,
                        color: '#FFFFFF',
                        textAlign: 'center',
                        textShadow: '4px 4px 0px rgba(0,0,0,0.3), 8px 8px 20px rgba(0,0,0,0.2)',
                        lineHeight: 1.3,
                        opacity: fadeProgress,
                        transform: `scale(${interpolate(fadeProgress, [0, 1], [0.9, 1])})`,
                        maxWidth: '90%',
                        wordWrap: 'break-word',
                    }}
                >
                    {currentGroup.map((wordData, idx) => (
                        <AnimatedWord
                            key={`${currentGroupIndex}-${idx}`}
                            word={wordData.text}
                            isActive={frame >= wordData.startFrame && frame <= wordData.endFrame}
                            animationStyle={animationStyle}
                            frame={frame - wordData.startFrame}
                            fps={fps}
                        />
                    ))}
                </div>
            </AbsoluteFill>

            {/* Subtle gradient overlay for depth */}
            <AbsoluteFill
                style={{
                    background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 100%)',
                    pointerEvents: 'none',
                }}
            />
        </AbsoluteFill>
    );
};
