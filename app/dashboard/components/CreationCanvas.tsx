import React from 'react';
import { SparklesIcon } from './icons';
import { CollectedAsset } from '@/lib/apiClient';

interface CreationCanvasProps {
    mode: 'face' | 'faceless';
    inputText: string;
    setInputText: (val: string) => void;
    isEnhanced: boolean;
    setIsEnhanced: (val: boolean) => void;
    isProcessing: boolean;
    handleEnhanceWithAI: () => void;

    // Asset Collection
    isCollectingAssets: boolean;
    collectedAssets: CollectedAsset[];
    handleCollectAssets: () => void;
}

export const CreationCanvas: React.FC<CreationCanvasProps> = ({
    mode,
    inputText,
    setInputText,
    setIsEnhanced,
    isProcessing,
    handleEnhanceWithAI,
    isCollectingAssets,
    collectedAssets,
    handleCollectAssets
}) => {
    return (
        <div className="relative z-10">
            {/* Top Bar: Actions */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                {/* Collect Assets Button */}
                <button
                    onClick={handleCollectAssets}
                    disabled={!inputText.trim() || isCollectingAssets}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)] ${isCollectingAssets ? 'opacity-50' : 'opacity-100'} text-[var(--text-secondary)]`}
                    title="Find relevant images for your script"
                >
                    <span>📷</span> {isCollectingAssets ? 'Collecting...' : collectedAssets.length > 0 ? `Assets (${collectedAssets.length})` : 'Collect Assets'}
                </button>

                {/* Enhance Button */}
                <button
                    onClick={handleEnhanceWithAI}
                    disabled={!inputText.trim() || isProcessing}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-0 text-[var(--brand-primary)] hover:bg-[var(--surface-1)]`}
                >
                    <SparklesIcon /> Enhance
                </button>
            </div>

            {/* Main Text Input */}
            <div className="p-8 pb-2 min-h-[220px]">
                <textarea
                    value={inputText}
                    onChange={(e) => { setInputText(e.target.value); setIsEnhanced(false); }}
                    placeholder={mode === 'faceless' ? "What should this video be about?..." : "Type your script or describe your video topic..."}
                    className="w-full h-full min-h-[160px] text-xl font-medium leading-relaxed resize-none border-0 focus:outline-none bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                    style={{ fontVariationSettings: '"wdth" 100, "wght" 500' }}
                />
            </div>
        </div>
    );
};
