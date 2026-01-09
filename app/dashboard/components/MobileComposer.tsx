'use client';

import React, { useRef, useEffect } from 'react';
import { SparklesIcon, MicIcon, ClockIcon } from './icons';
import { MobileSheetType } from './MobileOverlays';

interface MobileComposerProps {
    inputText: string;
    setInputText: (text: string) => void;
    onGenerate: () => void;
    isProcessing: boolean;
    processingMessage: string;
    enableCaptions: boolean;
    setEnableCaptions: (enabled: boolean) => void;
    enableBackgroundMusic: boolean;
    setEnableBackgroundMusic: (enabled: boolean) => void;
    onEnhance: () => void;
    onCollectAssets: () => void;
    isEnhancing: boolean;
    isCollectingAssets: boolean;
    onOpenSheet: (sheet: MobileSheetType) => void;
    voiceName?: string;
    avatarUrl?: string;
    mode?: 'face' | 'faceless';
    duration?: number;
    aspectRatio?: string;
    hasScript: boolean;
    hasAssets: boolean;
    hasStoryboard: boolean;
    hasVideo: boolean;
}

export const MobileComposer: React.FC<MobileComposerProps> = ({
    inputText,
    setInputText,
    onGenerate,
    isProcessing,
    processingMessage,
    enableCaptions,
    setEnableCaptions,
    enableBackgroundMusic,
    setEnableBackgroundMusic,
    onEnhance,
    isEnhancing,
    onOpenSheet,
    voiceName = 'Voice',
    avatarUrl,
    mode = 'faceless',
    duration = 30,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px';
        }
    }, [inputText]);

    // Processing state - premium glass overlay
    if (isProcessing) {
        return (
            <div className="fixed top-14 left-0 right-0 z-40 px-4 pt-4">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-white/60">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 opacity-20 animate-ping absolute" />
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                                <SparklesIcon className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Creating your video</p>
                            <p className="text-sm text-gray-500">{processingMessage}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed top-14 left-0 right-0 z-40">
            {/* Subtle gradient glow background */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-transparent pointer-events-none" />

            {/* Main Content */}
            <div className="relative px-4 pt-4 pb-2">
                {/* Glass Input Card */}
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100/80">
                    {/* Textarea */}
                    <textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="What's your video about?"
                        className="w-full bg-transparent text-xl font-light placeholder:text-gray-300 focus:outline-none resize-none leading-relaxed tracking-tight"
                        rows={3}
                    />

                    {/* Action Row */}
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100/60">
                        {/* AI Enhance */}
                        <button
                            onClick={onEnhance}
                            disabled={!inputText.trim() || isEnhancing}
                            className="flex items-center gap-2 text-sm text-gray-400 hover:text-purple-600 disabled:opacity-30 transition-all duration-200"
                        >
                            <div className="w-7 h-7 rounded-full bg-purple-50 flex items-center justify-center">
                                <SparklesIcon className="w-3.5 h-3.5 text-purple-500" />
                            </div>
                            <span className="font-medium">{isEnhancing ? 'Writing...' : 'Enhance'}</span>
                        </button>

                        <div className="flex-1" />

                        {/* Generate Button - Premium */}
                        <button
                            onClick={onGenerate}
                            disabled={!inputText.trim()}
                            className="group px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-semibold text-sm disabled:opacity-30 hover:shadow-[0_0_25px_rgba(139,92,246,0.35)] active:scale-[0.98] transition-all duration-200"
                        >
                            Generate
                            <span className="inline-block ml-1.5 group-hover:translate-x-0.5 transition-transform">→</span>
                        </button>
                    </div>
                </div>

                {/* Settings Bar - Minimal */}
                <div className="flex items-center justify-center gap-1 mt-4 px-2">
                    <button
                        onClick={() => onOpenSheet('face')}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-gray-100/80 transition-colors"
                    >
                        {mode === 'face' && avatarUrl ? (
                            <img src={avatarUrl} className="w-5 h-5 rounded-full object-cover ring-1 ring-gray-200" />
                        ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                                <span className="text-[10px]">👤</span>
                            </div>
                        )}
                        <span>{mode === 'face' ? 'Face' : 'None'}</span>
                    </button>

                    <div className="w-px h-4 bg-gray-200" />

                    <button
                        onClick={() => onOpenSheet('voice')}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-gray-100/80 transition-colors"
                    >
                        <MicIcon className="w-4 h-4" />
                        <span className="max-w-[50px] truncate">{voiceName}</span>
                    </button>

                    <div className="w-px h-4 bg-gray-200" />

                    <button
                        onClick={() => onOpenSheet('duration')}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-gray-100/80 transition-colors"
                    >
                        <ClockIcon className="w-4 h-4" />
                        <span>{duration}s</span>
                    </button>

                    <div className="w-px h-4 bg-gray-200" />

                    <button
                        onClick={() => setEnableCaptions(!enableCaptions)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${enableCaptions ? 'bg-purple-100 text-purple-700' : 'text-gray-400 hover:bg-gray-100/80'}`}
                    >
                        CC
                    </button>

                    <button
                        onClick={() => setEnableBackgroundMusic(!enableBackgroundMusic)}
                        className={`px-3 py-2 rounded-xl text-xs transition-all ${enableBackgroundMusic ? 'bg-purple-100 text-purple-700' : 'text-gray-400 hover:bg-gray-100/80'}`}
                    >
                        ♫
                    </button>
                </div>
            </div>
        </div>
    );
};
