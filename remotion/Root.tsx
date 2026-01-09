import { Composition } from 'remotion';
import { VideoComposition, VideoCompositionProps } from './compositions/VideoComposition';

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="VideoComposition"
                component={VideoComposition}
                durationInFrames={30 * 60} // 60 seconds default, will be overridden
                fps={30}
                width={1080}
                height={1920}
                defaultProps={{
                    scenes: [],
                    captions: [],
                    enableCaptions: true,
                    captionStyle: 'bold-classic'
                } as VideoCompositionProps}
                calculateMetadata={async ({ props }) => {
                    // Calculate total duration from all scenes
                    const totalDuration = props.scenes.reduce(
                        (acc, scene) => acc + scene.durationInFrames,
                        0
                    );
                    return {
                        durationInFrames: Math.max(totalDuration, 30), // At least 1 second
                    };
                }}
            />
        </>
    );
};
