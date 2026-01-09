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

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const maxHeight = 150;
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, maxHeight) + 'px';
        }
    }, [inputText]);

    // Processing state view
    if (isProcessing) {
        return (
            <div className="fixed top-14 left-0 right-0 bg-white border-b-2 border-black px-4 py-4 z-40 shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[var(--brand-primary)] animate-spin flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-black">Generating...</p>
                        <p className="text-sm text-gray-500 truncate">{processingMessage}</p>
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
        <div className="fixed top-14 left-0 right-0 z-40 bg-white border-b-2 border-black shadow-lg">
            {/* Large Input Area */}
            <div className="p-4 pb-3">
                <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="What's your video about? Describe your topic in detail..."
                    className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-base font-medium placeholder:text-gray-400 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 resize-none leading-relaxed"
                    rows={3}
                />

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2 mt-3">
                    <button
                        onClick={onEnhance}
                        disabled={!inputText.trim() || isEnhancing}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-100 text-purple-700 font-bold text-sm disabled:opacity-40 active:scale-95 transition-all"
                    >
                        <SparklesIcon className="w-4 h-4" />
                        {isEnhancing ? 'Writing...' : 'AI Write'}
                    </button>

                    <button
                        onClick={onCollectAssets}
                        disabled={!inputText.trim() || isCollectingAssets}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-100 text-blue-700 font-bold text-sm disabled:opacity-40 active:scale-95 transition-all"
                    >
                        <ImageIcon className="w-4 h-4" />
                        {isCollectingAssets ? 'Finding...' : 'Find Images'}
                    </button>

                    <div className="flex-1" />

                    <button
                        onClick={onGenerate}
                        disabled={!inputText.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-primary)] rounded-xl font-black text-sm text-black border-2 border-black shadow-[3px_3px_0px_#000] disabled:opacity-50 active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all"
                    >
                        Generate
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Settings Pills Row */}
            <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => onOpenSheet('face')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-xs font-medium flex-shrink-0"
                >
                    {mode === 'face' && avatarUrl ? (
                        <img src={avatarUrl} className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                        <span>👤</span>
                    )}
                    <span>{mode === 'face' ? 'Face' : 'Faceless'}</span>
                </button>

                <button
                    onClick={() => onOpenSheet('voice')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-xs font-medium flex-shrink-0"
                >
                    <MicIcon className="w-3 h-3" />
                    <span className="truncate max-w-[60px]">{voiceName}</span>
                </button>

                <button
                    onClick={() => onOpenSheet('duration')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-xs font-medium flex-shrink-0"
                >
                    <ClockIcon className="w-3 h-3" />
                    <span>{duration}s</span>
                </button>

                <button
                    onClick={() => onOpenSheet('aspect')}
                    className="px-3 py-1.5 rounded-full bg-gray-100 text-xs font-medium flex-shrink-0"
                >
                    {aspectRatio}
                </button>

                <div className="flex-1" />

                <button
                    onClick={() => setEnableCaptions(!enableCaptions)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 ${enableCaptions ? 'bg-[var(--brand-primary)] text-black' : 'bg-gray-100 text-gray-500'}`}
                >
                    CC
                </button>

                <button
                    onClick={() => setEnableBackgroundMusic(!enableBackgroundMusic)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-all flex-shrink-0 ${enableBackgroundMusic ? 'bg-[var(--brand-primary)] text-black' : 'bg-gray-100 text-gray-500'}`}
                >
                    ♫
                </button>
            </div>

            {/* Workflow Steps - Only show if there's progress */}
            {hasActiveWorkflow && (
                <div className="flex items-center justify-around px-4 py-2 border-t border-gray-100 bg-gray-50/80">
                    {workflowSteps.map((step) => (
                        <button
                            key={step.id}
                            onClick={() => step.active && onOpenSheet(step.id as MobileSheetType)}
                            disabled={!step.active}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${step.active ? 'bg-white shadow-sm' : 'opacity-30'}`}
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
