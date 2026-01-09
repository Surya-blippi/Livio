import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';

interface AssetSceneProps {
    imageUrl: string;
    durationInFrames: number;
    effectType?: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'zoom-pan';
}

export const AssetScene: React.FC<AssetSceneProps> = ({
    imageUrl,
    durationInFrames,
    effectType = 'zoom-in'
}) => {
    const frame = useCurrentFrame();
    const progress = frame / durationInFrames;

    // Smooth Ken Burns parameters
    const zoomStart = 1.0;
    const zoomEnd = 1.15;

    // Calculate zoom and pan based on effect type
    let scale = 1;
    let translateX = 0;
    let translateY = 0;

    switch (effectType) {
        case 'zoom-in':
            scale = interpolate(frame, [0, durationInFrames], [zoomStart, zoomEnd], {
                extrapolateRight: 'clamp'
            });
            break;

        case 'zoom-out':
            scale = interpolate(frame, [0, durationInFrames], [zoomEnd, zoomStart], {
                extrapolateRight: 'clamp'
            });
            break;

        case 'pan-left':
            scale = 1.15;
            translateX = interpolate(frame, [0, durationInFrames], [5, -5], {
                extrapolateRight: 'clamp'
            });
            break;

        case 'pan-right':
            scale = 1.15;
            translateX = interpolate(frame, [0, durationInFrames], [-5, 5], {
                extrapolateRight: 'clamp'
            });
            break;

        case 'zoom-pan':
            scale = interpolate(frame, [0, durationInFrames], [zoomStart, zoomEnd], {
                extrapolateRight: 'clamp'
            });
            translateX = interpolate(frame, [0, durationInFrames], [-3, 3], {
                extrapolateRight: 'clamp'
            });
            break;
    }

    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            <Img
                src={imageUrl}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
                    transformOrigin: 'center center'
                }}
            />
        </AbsoluteFill>
    );
};

// Effect type selector based on scene index
export function getEffectForScene(sceneIndex: number): AssetSceneProps['effectType'] {
    const effects: AssetSceneProps['effectType'][] = [
        'zoom-in',
        'pan-right',
        'zoom-out',
        'pan-left',
        'zoom-pan'
    ];
    return effects[sceneIndex % effects.length];
}
