'use client';

import React, { useRef, useEffect } from 'react';
import { SparklesIcon, MicIcon, ClockIcon, ImageIcon, VideoIcon } from './icons';
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
    onCollectAssets,
    isEnhancing,
    isCollectingAssets,
    onOpenSheet,
    voiceName = 'Voice',
    avatarUrl,
    mode = 'faceless',
    duration = 30,
    hasScript,
    hasAssets,
    hasStoryboard,
    hasVideo,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
        }
    }, [inputText]);

    // Processing state - matches desktop style
    if (isProcessing) {
        return (
            <div className="px-4 pt-2 pb-4">
                <div className="bg-white border-2 border-black rounded-[var(--radius-lg)] p-4 shadow-[4px_4px_0px_var(--brand-primary)]">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 relative">
                            <div className="absolute inset-0 rounded-full border-2 border-gray-100" />
                            <div className="absolute inset-0 rounded-full border-2 border-t-black animate-spin" />
                        </div>
                        <div>
                            <p className="font-black text-black">Generating...</p>
                            <p className="text-sm text-[var(--text-secondary)]">{processingMessage}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 pt-2">
            {/* Composer Card */}
            <div className="bg-white border-2 border-black rounded-[var(--radius-lg)] shadow-[4px_4px_0px_rgba(0,0,0,1)]">

                {/* Toolbar Row */}
                <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50/50 rounded-t-[var(--radius-lg)] overflow-x-auto no-scrollbar">
                    {/* Mode Pill */}
                    <button
                        onClick={() => onOpenSheet('face')}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-transparent hover:border-gray-200 hover:bg-white transition-all"
                    >
                        <div className="w-4 h-4 rounded-full bg-gray-200 overflow-hidden border border-black flex items-center justify-center">
                            {mode === 'faceless' ? (
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                                </svg>
                            ) : avatarUrl ? (
                                <img src={avatarUrl} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-[var(--brand-primary)]" />
                            )}
                        </div>
                        <span className="text-[10px] font-bold text-black uppercase tracking-wide">{mode === 'faceless' ? 'None' : 'Face'}</span>
                    </button>

                    <div className="w-px h-3 bg-gray-300" />

                    {/* Voice Pill */}
                    <button
                        onClick={() => onOpenSheet('voice')}
                        className="flex items-center gap-1 px-2 py-1 rounded-full border border-transparent hover:border-gray-200 hover:bg-white transition-all text-[10px] font-bold text-[var(--text-secondary)] hover:text-black uppercase tracking-wide"
                    >
                        <MicIcon className="w-3 h-3" />
                        <span className="max-w-[50px] truncate">{voiceName}</span>
                    </button>

                    <div className="w-px h-3 bg-gray-300" />

                    {/* Duration Pill */}
                    <button
                        onClick={() => onOpenSheet('duration')}
                        className="flex items-center gap-1 px-2 py-1 rounded-full border border-transparent hover:border-gray-200 hover:bg-white transition-all text-[10px] font-bold text-[var(--text-secondary)] hover:text-black uppercase tracking-wide"
                    >
                        <ClockIcon className="w-3 h-3" />
                        <span>{duration}s</span>
                    </button>

                    <div className="flex-1" />

                    {/* Captions Toggle */}
                    <button
                        onClick={() => setEnableCaptions(!enableCaptions)}
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all ${enableCaptions ? 'bg-[var(--brand-primary)] border-black text-black' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
                    >
                        CC
                    </button>

                    {/* Music Toggle */}
                    <button
                        onClick={() => setEnableBackgroundMusic(!enableBackgroundMusic)}
                        className={`px-2 py-1 rounded-full text-xs border transition-all ${enableBackgroundMusic ? 'bg-[var(--brand-primary)] border-black text-black' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
                    >
                        ♫
                    </button>
                </div>

                {/* Input Area */}
                <div className="px-4 py-3">
                    <textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="What's your video about?"
                        className="w-full bg-transparent text-base font-medium placeholder:text-gray-300 focus:outline-none resize-none leading-snug"
                        rows={2}
                    />

                    {/* Actions Row */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        {/* AI Enhance */}
                        <button
                            onClick={onEnhance}
                            disabled={!inputText.trim() || isEnhancing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-bold text-[var(--text-secondary)] hover:border-purple-500 hover:text-purple-600 disabled:opacity-30 transition-all"
                        >
                            <SparklesIcon className="w-3 h-3" />
                            {isEnhancing ? 'Writing...' : 'AI Write'}
                        </button>

                        {/* Find Assets */}
                        <button
                            onClick={onCollectAssets}
                            disabled={!inputText.trim() || isCollectingAssets}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-bold text-[var(--text-secondary)] hover:border-blue-500 hover:text-blue-600 disabled:opacity-30 transition-all"
                        >
                            <ImageIcon className="w-3 h-3" />
                            {isCollectingAssets ? 'Finding...' : 'Find Assets'}
                        </button>

                        <div className="flex-1" />

                        {/* Generate Button - Neo-brutalist style */}
                        <button
                            onClick={onGenerate}
                            disabled={!inputText.trim()}
                            className="px-5 py-2 bg-[var(--brand-primary)] text-black rounded-xl font-black text-sm border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 disabled:opacity-30 disabled:hover:shadow-[3px_3px_0px_#000] disabled:hover:translate-y-0 transition-all"
                        >
                            Generate →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
