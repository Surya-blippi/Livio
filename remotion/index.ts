// Remotion entry point
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

// Register the root component for Remotion
registerRoot(RemotionRoot);

// Export components for use in other parts of the app
export { RemotionRoot } from './Root';
export { VideoComposition, type VideoCompositionProps, type SceneData } from './compositions/VideoComposition';
export { AssetScene, getEffectForScene } from './compositions/AssetScene';
export { Captions, type CaptionWord } from './compositions/Captions';
export { TypographyComposition, type TypographyCompositionProps, type TypographyWord } from './compositions/TypographyComposition';
