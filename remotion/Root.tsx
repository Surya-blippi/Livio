import { Composition } from 'remotion';
import { VideoComposition } from './compositions/VideoComposition';

// Default props for the composition
const defaultVideoProps = {
    scenes: [] as Array<{
        id: string;
        imageUrl: string;
        audioUrl: string;
        durationInFrames: number;
        text: string;
    }>,
    captions: [] as Array<{
        text: string;
        startMs: number;
        endMs: number;
    }>,
    enableCaptions: true,
    captionStyle: 'bold-classic' as string
};

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="VideoComposition"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                component={VideoComposition as any}
                durationInFrames={30 * 60}
                fps={30}
                width={1080}
                height={1920}
                defaultProps={defaultVideoProps}
                calculateMetadata={async ({ props }) => {
                    const typedProps = props as typeof defaultVideoProps;
                    const totalDuration = typedProps.scenes.reduce(
                        (acc, scene) => acc + scene.durationInFrames,
                        0
                    );
                    return {
                        durationInFrames: Math.max(totalDuration, 30),
                    };
                }}
            />
        </>
    );
};
