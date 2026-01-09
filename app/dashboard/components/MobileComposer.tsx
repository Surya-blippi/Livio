'use client';

import React, { useRef, useEffect } from 'react';
import { SparklesIcon, MicIcon, ImageIcon, ClockIcon, VideoIcon } from './icons';
import { MobileSheetType } from './MobileOverlays';

interface MobileComposerProps {
    inputText: string;
    setInputText: (text: string) => void;
    onGenerate: () => void;
    isProcessing: boolean;
    processingMessage: string;

    // Quick toggles
    enableCaptions: boolean;
    setEnableCaptions: (enabled: boolean) => void;
    enableBackgroundMusic: boolean;
    setEnableBackgroundMusic: (enabled: boolean) => void;

    // Actions
    onEnhance: () => void;
    onCollectAssets: () => void;
    isEnhancing: boolean;
    isCollectingAssets: boolean;

    // Sheet triggers
    onOpenSheet: (sheet: MobileSheetType) => void;

    // Context display
    voiceName?: string;
    avatarUrl?: string;
    mode?: 'face' | 'faceless';
    duration?: number;
    aspectRatio?: string;

    // Workflow status
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
    aspectRatio = '9:16',
    hasScript,
    hasAssets,
    hasStoryboard,
    hasVideo
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea (max 2 lines for compact design)
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const maxHeight = 56; // ~2 lines
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, maxHeight) + 'px';
        }
    }, [inputText]);

    // Processing state view - compact top bar
    if (isProcessing) {
        return (
            <div className="fixed top-14 left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 z-40 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-3 border-gray-200 border-t-[var(--brand-primary)] animate-spin flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-black truncate">{processingMessage}</p>
                    </div>
                </div>
            </div>
        );
    }

    const workflowSteps = [
        { id: 'script', label: 'Script', icon: SparklesIcon, active: hasScript, color: 'from-purple-500 to-pink-500' },
        { id: 'assets', label: 'Assets', icon: ImageIcon, active: hasAssets, color: 'from-blue-500 to-cyan-500' },
        { id: 'storyboard', label: 'Scenes', icon: ClockIcon, active: hasStoryboard, color: 'from-orange-500 to-amber-500' },
        { id: 'video', label: 'Video', icon: VideoIcon, active: hasVideo, color: 'from-green-500 to-emerald-500' },
    ];

    const hasActiveWorkflow = hasScript || hasAssets || hasStoryboard || hasVideo;

    return (
        <div className="fixed top-14 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
            {/* Compact Input Row */}
            <div className="flex items-center gap-2 px-3 py-2">
                {/* Input */}
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="What's your video about?"
                        className="w-full px-3 py-2 bg-gray-100 rounded-xl text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none leading-snug"
                        rows={1}
                    />
                </div>

                {/* AI Write - Compact */}
                <button
                    onClick={onEnhance}
                    disabled={!inputText.trim() || isEnhancing}
                    className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
                    title="AI Write"
                >
                    <SparklesIcon className="w-4 h-4" />
                </button>

                {/* Generate Button */}
                <button
                    onClick={onGenerate}
                    disabled={!inputText.trim()}
                    className="h-9 px-4 bg-[var(--brand-primary)] rounded-xl flex items-center justify-center gap-1.5 font-bold text-sm text-black disabled:opacity-50 active:scale-95 transition-all flex-shrink-0"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    Go
                </button>
            </div>

            {/* Quick Settings Row - Ultra Compact */}
            <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar">
                {/* Mode Pill */}
                <button
                    onClick={() => onOpenSheet('face')}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs font-medium"
                >
                    {mode === 'face' && avatarUrl ? (
                        <img src={avatarUrl} className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                        <span className="text-[10px]">👤</span>
                    )}
                    <span>{mode === 'face' ? 'Face' : 'None'}</span>
                </button>

                {/* Voice Pill */}
                <button
                    onClick={() => onOpenSheet('voice')}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs font-medium"
                >
                    <MicIcon className="w-3 h-3" />
                    <span className="truncate max-w-[60px]">{voiceName}</span>
                </button>

                {/* Duration */}
                <button
                    onClick={() => onOpenSheet('duration')}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs font-medium"
                >
                    <ClockIcon className="w-3 h-3" />
                    <span>{duration}s</span>
                </button>

                {/* Aspect */}
                <button
                    onClick={() => onOpenSheet('aspect')}
                    className="px-2 py-1 rounded-lg bg-gray-100 text-xs font-medium"
                >
                    {aspectRatio}
                </button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* CC Toggle */}
                <button
                    onClick={() => setEnableCaptions(!enableCaptions)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${enableCaptions ? 'bg-[var(--brand-primary)] text-black' : 'bg-gray-100 text-gray-500'}`}
                >
                    CC
                </button>

                {/* Music Toggle */}
                <button
                    onClick={() => setEnableBackgroundMusic(!enableBackgroundMusic)}
                    className={`px-2 py-1 rounded-lg text-xs transition-all ${enableBackgroundMusic ? 'bg-[var(--brand-primary)] text-black' : 'bg-gray-100 text-gray-500'}`}
                >
                    ♫
                </button>

                {/* Find Images */}
                <button
                    onClick={onCollectAssets}
                    disabled={!inputText.trim() || isCollectingAssets}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 text-blue-600 text-xs font-medium disabled:opacity-40"
                >
                    <ImageIcon className="w-3 h-3" />
                    {isCollectingAssets ? '...' : 'Find'}
                </button>
            </div>

            {/* Workflow Steps - Only show if there's progress */}
            {hasActiveWorkflow && (
                <div className="flex items-center justify-around px-4 py-2 border-t border-gray-100 bg-gray-50/50">
                    {workflowSteps.map((step) => (
                        <button
                            key={step.id}
                            onClick={() => step.active && onOpenSheet(step.id as MobileSheetType)}
                            disabled={!step.active}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${step.active ? 'bg-white shadow-sm' : 'opacity-30'}`}
                        >
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center ${step.active ? `bg-gradient-to-br ${step.color}` : 'bg-gray-200'}`}>
                                <step.icon className={`w-3 h-3 ${step.active ? 'text-white' : 'text-gray-400'}`} />
                            </div>
                            <span className={`text-[10px] font-bold ${step.active ? 'text-black' : 'text-gray-400'}`}>
                                {step.label}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
