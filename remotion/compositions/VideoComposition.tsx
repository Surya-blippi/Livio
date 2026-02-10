import React from 'react';
import { AbsoluteFill, Sequence, Audio, OffthreadVideo } from 'remotion';
import { AssetScene } from './AssetScene';
import { Captions, CaptionWord } from './Captions';

// Scene types
export interface SceneData {
    type: 'face' | 'asset';
    videoUrl?: string;      // For face scenes (WaveSpeed video)
    imageUrl?: string;      // For asset scenes
    audioUrl: string;       // TTS audio for this scene
    durationInFrames: number;
    text: string;           // Scene text for captions
}

export interface VideoCompositionProps {
    scenes: SceneData[];
    captions: CaptionWord[];
    enableCaptions: boolean;
    captionStyle: string;
    backgroundColor?: string;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
    scenes,
    captions,
    enableCaptions,
    captionStyle,
    backgroundColor = '#000000'
}) => {
    const supportedCaptionStyles = new Set(['bold-classic', 'modern-pop', 'minimal', 'vibrant']);
    const resolvedCaptionStyle = supportedCaptionStyles.has(captionStyle) ? captionStyle as 'bold-classic' | 'modern-pop' | 'minimal' | 'vibrant' : 'bold-classic';

    // Calculate frame offsets for each scene
    let currentFrame = 0;
    const sceneFrameStarts: number[] = [];

    for (const scene of scenes) {
        sceneFrameStarts.push(currentFrame);
        currentFrame += scene.durationInFrames;
    }

    return (
        <AbsoluteFill style={{ backgroundColor }}>
            {/* Render each scene in sequence */}
            {scenes.map((scene, index) => (
                <Sequence
                    key={index}
                    from={sceneFrameStarts[index]}
                    durationInFrames={scene.durationInFrames}
                >
                    {scene.type === 'face' && scene.videoUrl ? (
                        // Face scene: render WaveSpeed video
                        <AbsoluteFill>
                            <OffthreadVideo
                                src={scene.videoUrl}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                        </AbsoluteFill>
                    ) : scene.type === 'asset' && scene.imageUrl ? (
                        // Asset scene: render Ken Burns effect
                        <AssetScene
                            imageUrl={scene.imageUrl}
                            durationInFrames={scene.durationInFrames}
                        />
                    ) : null}

                    {/* Audio for this scene */}
                    <Audio src={scene.audioUrl} />
                </Sequence>
            ))}

            {/* Captions overlay - rendered on top of all scenes */}
            {enableCaptions && captions.length > 0 && (
                <Captions words={captions} style={resolvedCaptionStyle} />
            )}
        </AbsoluteFill>
    );
};
