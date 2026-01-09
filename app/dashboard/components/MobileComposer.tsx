'use client';

import React, { useRef, useEffect, useState } from 'react';
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
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
        }
    }, [inputText]);

    // Processing state - clean overlay
    if (isProcessing) {
        return (
            <div className="fixed top-14 left-0 right-0 bg-white/95 backdrop-blur-sm px-6 py-5 z-40">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-black animate-spin" />
                    <p className="text-sm text-gray-600">{processingMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed top-14 left-0 right-0 z-40 bg-white">
            {/* Main Input Area - Clean & Spacious */}
            <div className="px-5 pt-5 pb-4">
                <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="What's your video about?"
                    className="w-full px-0 py-0 bg-transparent text-lg font-medium placeholder:text-gray-300 focus:outline-none resize-none leading-relaxed border-none"
                    rows={3}
                />

                {/* Action Row */}
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                    {/* AI Enhance - Subtle */}
                    <button
                        onClick={onEnhance}
                        disabled={!inputText.trim() || isEnhancing}
                        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-purple-600 disabled:opacity-30 transition-colors"
                    >
                        <SparklesIcon className="w-4 h-4" />
                        <span>{isEnhancing ? 'Writing...' : 'AI Write'}</span>
                    </button>

                    <div className="flex-1" />

                    {/* Generate Button - Full Focus */}
                    <button
                        onClick={onGenerate}
                        disabled={!inputText.trim()}
                        className="px-6 py-2.5 bg-black text-white rounded-full text-sm font-semibold disabled:opacity-30 active:scale-95 transition-all"
                    >
                        Generate Video
                    </button>
                </div>
            </div>

            {/* Minimal Settings Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 bg-gray-50/50">
                {/* Left: Key Settings */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => onOpenSheet('face')}
                        className="flex items-center gap-1.5 text-xs text-gray-500"
                    >
                        {mode === 'face' && avatarUrl ? (
                            <img src={avatarUrl} className="w-5 h-5 rounded-full" />
                        ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px]">👤</div>
                        )}
                        <span>{mode === 'face' ? 'Avatar' : 'No Face'}</span>
                    </button>

                    <button
                        onClick={() => onOpenSheet('voice')}
                        className="flex items-center gap-1.5 text-xs text-gray-500"
                    >
                        <MicIcon className="w-4 h-4" />
                        <span className="max-w-[50px] truncate">{voiceName}</span>
                    </button>

                    <button
                        onClick={() => onOpenSheet('duration')}
                        className="flex items-center gap-1.5 text-xs text-gray-500"
                    >
                        <ClockIcon className="w-4 h-4" />
                        <span>{duration}s</span>
                    </button>
                </div>

                {/* Right: Toggles */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setEnableCaptions(!enableCaptions)}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${enableCaptions ? 'bg-black text-white' : 'text-gray-400'}`}
                    >
                        CC
                    </button>
                    <button
                        onClick={() => setEnableBackgroundMusic(!enableBackgroundMusic)}
                        className={`px-2 py-1 rounded text-xs transition-all ${enableBackgroundMusic ? 'bg-black text-white' : 'text-gray-400'}`}
                    >
                        ♫
                    </button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-1.5 rounded text-gray-400 hover:text-black transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Subtle bottom line */}
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        </div>
    );
};
