'use client';

import React, { useRef, useEffect, useState } from 'react';
import { SparklesIcon, MicIcon, ClockIcon, ImageIcon, VideoIcon } from './icons';
import { MobileSheetType } from './MobileOverlays';

interface MobileComposerProps {
    inputText: string;
    setInputText: (text: string) => void;
    onGenerate: () => void;
    isProcessing: boolean;
    processingMessage: string;
    processingStep?: number;
    sceneProgress?: {
        totalScenes: number;
        processedScenesCount: number;
        currentSceneIndex: number;
        isRendering: boolean;
    } | null;
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
    editType?: 'minimal' | 'motion' | 'typography';
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
    processingStep = 0,
    sceneProgress,
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
    editType = 'minimal',
    duration = 30,
    aspectRatio = '9:16',
    hasScript,
    hasAssets,
    hasStoryboard,
    hasVideo,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showShortInputWarning, setShowShortInputWarning] = useState(false);

    // Guided Flow State
    const [flowStep, setFlowStep] = useState<'input' | 'refine' | 'assets' | 'ready'>('input');
    const [didRequestEnhance, setDidRequestEnhance] = useState(false);
    const [didRequestAssets, setDidRequestAssets] = useState(false);

    // Auto-advance after enhancement
    useEffect(() => {
        if (didRequestEnhance && !isEnhancing) {
            setDidRequestEnhance(false);
            setFlowStep(editType === 'typography' ? 'ready' : 'assets');
        }
    }, [isEnhancing, didRequestEnhance, editType]);

    // Auto-advance after asset collection
    useEffect(() => {
        if (didRequestAssets && !isCollectingAssets) {
            setDidRequestAssets(false);
            setFlowStep('ready');
        }
    }, [isCollectingAssets, didRequestAssets]);

    // Reset flow if input is cleared
    useEffect(() => {
        if (!inputText.trim() && flowStep !== 'input') {
            setFlowStep('input');
        }
    }, [inputText, flowStep]);

    // Helper to count words in input text
    const getWordCount = (text: string) => {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    };

    // Check if input is too short (5 words or less) - likely just a topic, not a full script
    const isInputTooShort = (text: string) => {
        return getWordCount(text) <= 5;
    };

    // Handle generate button click with validation
    const handleGenerateClick = () => {
        if (isInputTooShort(inputText)) {
            setShowShortInputWarning(true);
            // Auto-hide warning after 5 seconds
            setTimeout(() => setShowShortInputWarning(false), 5000);
            return;
        }
        setShowShortInputWarning(false);
        onGenerate();
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
        }
    }, [inputText]);

    // Processing state - matches desktop style with scene checklist
    if (isProcessing) {
        return (
            <div className="px-4 pt-2 pb-4">
                <div className="bg-white border-2 border-black rounded-[var(--radius-lg)] p-4 shadow-[4px_4px_0px_var(--brand-primary)] relative overflow-hidden">
                    {/* Progress bar */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
                        <div
                            className="h-full bg-[var(--brand-primary)] transition-all duration-300"
                            style={{
                                width: `${sceneProgress
                                    ? Math.min((sceneProgress.processedScenesCount / sceneProgress.totalScenes) * 100, 100)
                                    : Math.min(processingStep * 25, 100)}%`
                            }}
                        />
                    </div>

                    <h3 className="text-lg font-black mb-3 text-center mt-1">Generating Video...</h3>

                    {/* Scene Checklist */}
                    {sceneProgress && sceneProgress.totalScenes > 0 ? (
                        <div className="space-y-1.5 mb-3">
                            {Array.from({ length: sceneProgress.totalScenes }, (_, i) => {
                                const isCompleted = i < sceneProgress.processedScenesCount;
                                const isCurrent = i === sceneProgress.currentSceneIndex && !sceneProgress.isRendering;
                                return (
                                    <div
                                        key={i}
                                        className={`flex items-center gap-2 p-1.5 rounded-lg transition-all text-sm ${isCompleted ? 'bg-green-50' : isCurrent ? 'bg-yellow-50' : 'bg-gray-50'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isCompleted ? 'bg-green-500 border-green-600' : isCurrent ? 'border-yellow-500 bg-yellow-100' : 'border-gray-300'
                                            }`}>
                                            {isCompleted ? (
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : isCurrent ? (
                                                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                            ) : null}
                                        </div>
                                        <span className={`font-semibold ${isCompleted ? 'text-green-700' : isCurrent ? 'text-yellow-700' : 'text-gray-400'
                                            }`}>
                                            Scene {i + 1}
                                        </span>
                                        {isCompleted && <span className="text-green-600 text-xs ml-auto">✓</span>}
                                        {isCurrent && <span className="text-yellow-600 text-xs ml-auto animate-pulse">...</span>}
                                    </div>
                                );
                            })}

                            {/* Final Render Step */}
                            <div className={`flex items-center gap-2 p-1.5 rounded-lg transition-all text-sm ${sceneProgress.isRendering ? 'bg-purple-50' : 'bg-gray-50/50'
                                }`}>
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${sceneProgress.isRendering ? 'border-purple-500 bg-purple-100' : 'border-gray-300'
                                    }`}>
                                    {sceneProgress.isRendering && <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />}
                                </div>
                                <span className={`font-semibold ${sceneProgress.isRendering ? 'text-purple-700' : 'text-gray-400'
                                    }`}>
                                    Final Render
                                </span>
                                {sceneProgress.isRendering && (
                                    <span className="text-purple-600 text-xs ml-auto animate-pulse">...</span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-3 mb-3">
                            <div className="w-6 h-6 rounded-full border-3 border-gray-100 border-t-black animate-spin" />
                        </div>
                    )}

                    <p className="font-medium text-[var(--text-secondary)] text-center text-xs">{processingMessage}</p>
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

                    <div className="w-px h-3 bg-gray-300" />

                    {/* Aspect Ratio Pill */}
                    <button
                        onClick={() => onOpenSheet('aspect')}
                        className="flex items-center gap-1 px-2 py-1 rounded-full border border-transparent hover:border-gray-200 hover:bg-white transition-all text-[10px] font-bold text-[var(--text-secondary)] hover:text-black uppercase tracking-wide"
                    >
                        <VideoIcon className="w-3 h-3" />
                        <span>{aspectRatio}</span>
                    </button>

                    <div className="w-px h-3 bg-gray-300" />

                    {/* Edit Type Pill */}
                    <button
                        onClick={() => onOpenSheet('editType')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all text-[10px] font-bold uppercase tracking-wide ${editType === 'motion' ? 'border-purple-400 bg-purple-50 text-purple-700' : editType === 'typography' ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-transparent hover:border-gray-200 hover:bg-white text-[var(--text-secondary)] hover:text-black'}`}
                    >
                        {editType === 'motion' ? (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                            </svg>
                        ) : editType === 'typography' ? (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="4 7 4 4 20 4 20 7"></polyline>
                                <line x1="9" y1="20" x2="15" y2="20"></line>
                                <line x1="12" y1="4" x2="12" y2="20"></line>
                            </svg>
                        ) : (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="9" y1="3" x2="9" y2="21"></line>
                            </svg>
                        )}
                        <span>{editType === 'motion' ? 'Motion' : editType === 'typography' ? 'Typo' : 'Minimal'}</span>
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
                    {showShortInputWarning && (
                        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                            Add a full sentence or short script before generating. Very short topics are less reliable.
                        </div>
                    )}

                    {/* Actions Row */}
                    {/* C. GUIDED FLOW ACTIONS */}
                    <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100 min-h-[50px] transition-all">

                        {/* STEP 1: INPUT */}
                        {flowStep === 'input' && (
                            <div className="flex items-center justify-end">
                                <button
                                    onClick={() => {
                                        if (!inputText.trim()) return;
                                        setFlowStep('refine');
                                    }}
                                    disabled={!inputText.trim()}
                                    className="flex items-center gap-2 px-6 py-2 bg-black text-white text-xs font-bold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed w-full justify-center"
                                >
                                    <span>Next</span>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                </button>
                            </div>
                        )}

                        {/* STEP 2: REFINE (AI Script) */}
                        {flowStep === 'refine' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <p className="text-[10px] font-bold text-gray-900 flex items-center gap-1.5">
                                    <SparklesIcon className="w-3 h-3 text-purple-600" />
                                    Refine script with AI?
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setFlowStep(editType === 'typography' ? 'ready' : 'assets')}
                                        className="flex-1 py-2 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                                    >
                                        No, keep
                                    </button>
                                    <button
                                        onClick={() => {
                                            onEnhance();
                                            setDidRequestEnhance(true);
                                        }}
                                        disabled={isProcessing || isEnhancing}
                                        className="flex-[2] py-2 bg-purple-600 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-70"
                                    >
                                        {isEnhancing ? (
                                            <>
                                                <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Writing...</span>
                                            </>
                                        ) : (
                                            'Yes, AI Write'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: ASSETS (Check) */}
                        {flowStep === 'assets' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <p className="text-[10px] font-bold text-gray-900 flex items-center gap-1.5">
                                    <ImageIcon className="w-3 h-3 text-blue-600" />
                                    Find visuals?
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setFlowStep('ready')}
                                        className="flex-1 py-2 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                                    >
                                        No, skip
                                    </button>
                                    <button
                                        onClick={() => {
                                            onCollectAssets();
                                            setDidRequestAssets(true);
                                        }}
                                        disabled={isProcessing || isCollectingAssets}
                                        className="flex-[2] py-2 bg-blue-600 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-70"
                                    >
                                        {isCollectingAssets ? (
                                            <>
                                                <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Finding...</span>
                                            </>
                                        ) : (
                                            'Yes, Find Assets'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 4: READY (Generate) */}
                        {flowStep === 'ready' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center gap-2 mb-2">
                                    <button
                                        onClick={() => setFlowStep('input')}
                                        className="text-[10px] font-bold text-gray-400 flex items-center gap-1"
                                    >
                                        ← Start Over
                                    </button>
                                    <div className="flex-1 text-right text-[10px] font-medium text-green-600 flex items-center justify-end gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                        Ready
                                    </div>
                                </div>
                                <button
                                    onClick={handleGenerateClick}
                                    disabled={!inputText.trim() || isProcessing}
                                    className="w-full px-5 py-2.5 bg-[var(--brand-primary)] text-black rounded-xl font-black text-sm border-2 border-black shadow-[3px_3px_0px_#000] active:shadow-none active:translate-y-[3px] transition-all disabled:opacity-30 disabled:hover:shadow-[3px_3px_0px_#000]"
                                >
                                    Generate Video →
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};
