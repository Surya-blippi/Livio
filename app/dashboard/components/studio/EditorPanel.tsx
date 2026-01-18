import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon, MicIcon, ImageIcon, ClockIcon, VideoIcon } from '../icons';

interface EditorPanelProps {
    // Core
    mode: 'face' | 'faceless';
    setMode?: (mode: 'face' | 'faceless') => void;

    // Chat / Input
    inputText: string;
    setInputText: (text: string) => void;
    handleCreateVideo: () => void;
    isProcessing: boolean;
    processingMessage: string;
    processingStep: number;
    sceneProgress?: { totalScenes: number; currentSceneIndex: number; processedScenesCount: number; isRendering: boolean } | null;

    // Context / Config Data (For Pills)
    voiceName: string;
    avatarUrl?: string;
    aspectRatio: string;
    setAspectRatio: (ratio: string) => void;
    enableCaptions: boolean;
    setEnableCaptions: (enabled: boolean) => void;
    captionStyle: string;
    setCaptionStyle: (style: string) => void;
    enableBackgroundMusic: boolean;
    setEnableBackgroundMusic: (enabled: boolean) => void;
    duration: number;
    setDuration: (duration: number) => void;

    setPreviewMode: (mode: 'idle' | 'face' | 'voice' | 'video' | 'assets' | 'script' | 'storyboard' | 'captions' | 'music') => void;
    onEnhance: () => void;
    onCollectAssets: () => void;
    isCollectingAssets: boolean;
    isEnhancing: boolean;

    hasScript: boolean;
    hasAssets: boolean;
    hasStoryboard: boolean;
    hasVideo: boolean;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
    mode,
    setMode,
    inputText,
    setInputText,
    handleCreateVideo,
    isProcessing,
    processingMessage,
    processingStep,
    sceneProgress,
    voiceName,
    avatarUrl,
    aspectRatio,
    setAspectRatio,
    enableCaptions,
    setEnableCaptions,
    captionStyle,
    setCaptionStyle,
    enableBackgroundMusic,
    setEnableBackgroundMusic,
    duration,
    setDuration,
    setPreviewMode,
    onEnhance,
    onCollectAssets,
    isCollectingAssets,
    isEnhancing,

    hasScript,
    hasAssets,
    hasStoryboard,
    hasVideo
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showDurationMenu, setShowDurationMenu] = useState(false);
    const [showAspectMenu, setShowAspectMenu] = useState(false);
    const [showEditingModeMenu, setShowEditingModeMenu] = useState(false);
    const [editingMode, setEditingMode] = useState<'raw' | 'minimal' | 'polished'>('polished');

    // Auto-resize textarea with max height
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const maxHeight = 160; // ~4 lines
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, maxHeight) + 'px';
        }
    }, [inputText]);

    const steps = [
        { id: 'script', label: 'Script', icon: SparklesIcon, active: hasScript, color: 'text-purple-500' },
        { id: 'assets', label: 'Assets', icon: ImageIcon, active: hasAssets, color: 'text-blue-500' },
        { id: 'storyboard', label: 'Storyboard', icon: ClockIcon, active: hasStoryboard, color: 'text-orange-500' },
        { id: 'video', label: 'Video', icon: VideoIcon, active: hasVideo, color: 'text-[var(--brand-primary)]' },
    ];

    return (
        <>
            {/* ========== DESKTOP LAYOUT ========== */}
            <div className="hidden lg:flex flex-col h-full bg-transparent">

                {/* 1. Main Stage (Empty Space / Processing View) */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col items-center justify-center">
                    {/* Processing State - Scene Checklist */}
                    {isProcessing && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full max-w-md bg-white border-2 border-black rounded-[var(--radius-xl)] p-6 shadow-[8px_8px_0px_var(--brand-primary)] relative overflow-hidden"
                        >
                            {/* Progress bar */}
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100">
                                <motion.div
                                    className="h-full bg-[var(--brand-primary)]"
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${sceneProgress ? Math.min((sceneProgress.processedScenesCount / sceneProgress.totalScenes) * 100, 100) : Math.min(processingStep * 25, 100)}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>

                            <h3 className="text-xl font-black mb-4 text-center">Generating Video...</h3>

                            {/* Scene Checklist */}
                            {sceneProgress && sceneProgress.totalScenes > 0 ? (
                                <div className="space-y-2 mb-4">
                                    {Array.from({ length: sceneProgress.totalScenes }, (_, i) => {
                                        const isCompleted = i < sceneProgress.processedScenesCount;
                                        const isCurrent = i === sceneProgress.currentSceneIndex && !sceneProgress.isRendering;
                                        return (
                                            <div
                                                key={i}
                                                className={`flex items-center gap-3 p-2 rounded-lg transition-all ${isCompleted ? 'bg-green-50' : isCurrent ? 'bg-yellow-50' : 'bg-gray-50'
                                                    }`}
                                            >
                                                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isCompleted ? 'bg-green-500 border-green-600' : isCurrent ? 'border-yellow-500 bg-yellow-100' : 'border-gray-300'
                                                    }`}>
                                                    {isCompleted ? (
                                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    ) : isCurrent ? (
                                                        <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
                                                    ) : null}
                                                </div>
                                                <span className={`font-semibold text-sm ${isCompleted ? 'text-green-700' : isCurrent ? 'text-yellow-700' : 'text-gray-400'
                                                    }`}>
                                                    Scene {i + 1}
                                                </span>
                                                {isCompleted && <span className="text-green-600 text-xs ml-auto">✓ Done</span>}
                                                {isCurrent && <span className="text-yellow-600 text-xs ml-auto animate-pulse">Generating...</span>}
                                            </div>
                                        );
                                    })}

                                    {/* Final Render Step */}
                                    <div className={`flex items-center gap-3 p-2 rounded-lg transition-all ${sceneProgress.isRendering ? 'bg-purple-50' : sceneProgress.processedScenesCount >= sceneProgress.totalScenes ? 'bg-gray-50' : 'bg-gray-50/50'
                                        }`}>
                                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${sceneProgress.isRendering ? 'border-purple-500 bg-purple-100' : 'border-gray-300'
                                            }`}>
                                            {sceneProgress.isRendering && <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />}
                                        </div>
                                        <span className={`font-semibold text-sm ${sceneProgress.isRendering ? 'text-purple-700' : 'text-gray-400'
                                            }`}>
                                            Final Render
                                        </span>
                                        {sceneProgress.isRendering && (
                                            <span className="text-purple-600 text-xs ml-auto animate-pulse max-w-[150px] truncate text-right">
                                                {processingMessage || 'Composing...'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    <div className="w-8 h-8 rounded-full border-4 border-gray-100 border-t-black animate-spin" />
                                </div>
                            )}

                            <p className="font-medium text-[var(--text-secondary)] text-center text-sm">{processingMessage}</p>
                        </motion.div>
                    )}

                    {!isProcessing && (
                        <div className="w-full max-w-2xl mb-12 px-4 relative">
                            {/* Connecting Line */}
                            <div className="absolute top-7 left-10 right-10 h-1 bg-gray-100 -z-10 -translate-y-1/2 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-black/10"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(steps.filter(s => s.active).length - 1) / (steps.length - 1) * 100}%` }}
                                    transition={{ duration: 0.5, ease: "easeInOut" }}
                                />
                            </div>

                            <div className="flex justify-between items-start">
                                {steps.map((step, idx) => {
                                    // Script and Assets are always clickable (for editing/uploading)
                                    // Storyboard and Video only when they have content
                                    const alwaysClickable = step.id === 'script' || step.id === 'assets';
                                    const isReady = alwaysClickable || step.active;
                                    const hasContent = step.active;
                                    return (
                                        <button
                                            key={step.id}
                                            onClick={() => isReady && setPreviewMode(step.id as any)}
                                            disabled={!isReady}
                                            className={`group relative flex flex-col items-center gap-3 transition-all outline-none ${isReady ? 'cursor-pointer' : 'cursor-not-allowed opacity-40 grayscale'}`}
                                        >
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 z-10 relative overflow-hidden bg-white ${isReady ? 'border-black shadow-[4px_4px_0px_#000] group-hover:-translate-y-1 group-hover:shadow-[6px_6px_0px_#000] group-active:translate-y-0 group-active:shadow-[2px_2px_0px_#000]' : 'border-gray-200'}`}>
                                                <step.icon className={`w-6 h-6 transition-colors ${isReady ? (hasContent ? 'text-black' : 'text-gray-500') : 'text-gray-300'}`} />
                                            </div>
                                            <div className={`text-[10px] font-black uppercase tracking-wider transition-colors bg-white px-2 py-0.5 rounded-full border-2 ${isReady ? (hasContent ? 'border-black text-black group-hover:bg-[var(--brand-primary)]' : 'border-gray-400 text-gray-500 group-hover:border-black group-hover:text-black') : 'border-gray-100 text-gray-300'}`}>
                                                {step.label}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Composer Card - DESKTOP VERSION */}
                <div className="flex-shrink-0 p-4 md:p-6 bg-transparent">
                    <div className="w-full max-w-5xl mx-auto">
                        <div className="relative bg-white border-2 border-black rounded-[var(--radius-lg)] shadow-[8px_8px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1 hover:shadow-[12px_12px_0px_rgba(0,0,0,1)]">

                            {/* A. Toolbar (Top) */}
                            <div className="flex flex-wrap items-center gap-2 p-2 border-b border-gray-100 bg-gray-50/50 rounded-t-[var(--radius-lg)]">

                                {/* Mode Pill */}
                                <button onClick={() => setPreviewMode('face')} className="group flex items-center gap-2 px-2 py-1 rounded-full border border-transparent hover:border-gray-200 hover:bg-white transition-all">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border-2 border-black group-hover:scale-110 transition-transform flex items-center justify-center">
                                        {mode === 'faceless' ? (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                                            </svg>
                                        ) : avatarUrl ? (
                                            <img src={avatarUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-[var(--brand-primary)]" />
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold text-black uppercase tracking-wide">{mode === 'faceless' ? 'Faceless' : 'Avatar'}</span>
                                </button>

                                <div className="w-px h-3 bg-gray-300 mx-1"></div>

                                {/* Voice Pill */}
                                <button onClick={() => setPreviewMode('voice')} className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-transparent hover:border-gray-200 hover:bg-white transition-all text-[10px] font-bold text-[var(--text-secondary)] hover:text-black uppercase tracking-wide">
                                    <MicIcon className="w-3 h-3" />
                                    <span>{voiceName}</span>
                                </button>

                                <div className="w-px h-3 bg-gray-300 mx-1"></div>

                                {/* Duration - Dropup Menu */}
                                <div className="relative">
                                    <button
                                        onClick={() => { setShowDurationMenu(!showDurationMenu); setShowAspectMenu(false); }}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-transparent hover:border-gray-200 hover:bg-white transition-all text-[10px] font-bold text-[var(--text-secondary)] hover:text-black uppercase tracking-wide"
                                    >
                                        <ClockIcon className="w-3 h-3" />
                                        <span>{duration}s</span>
                                        <svg className="w-2 h-2 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6" /></svg>
                                    </button>
                                    {showDurationMenu && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowDurationMenu(false)} />
                                            <div className="absolute bottom-full left-0 mb-2 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_#000] overflow-hidden z-50 min-w-[100px]">
                                                {[15, 30, 60].map((d) => (
                                                    <button
                                                        key={d}
                                                        onClick={() => { setDuration(d); setShowDurationMenu(false); }}
                                                        className={`w-full px-4 py-2 text-left text-xs font-bold transition-colors flex items-center justify-between ${duration === d ? 'bg-[var(--brand-primary)] text-black' : 'hover:bg-gray-100 text-gray-700'}`}
                                                    >
                                                        <span>{d} seconds</span>
                                                        {duration === d && <span>✓</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Aspect Ratio */}
                                <div className="relative">
                                    <button
                                        onClick={() => { setShowAspectMenu(!showAspectMenu); setShowDurationMenu(false); }}
                                        className="px-2 py-1 rounded-full border border-transparent hover:border-gray-200 hover:bg-white transition-all text-[10px] font-bold text-[var(--text-secondary)] hover:text-black uppercase tracking-wide flex items-center gap-1"
                                    >
                                        <span>{aspectRatio}</span>
                                        <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6" /></svg>
                                    </button>
                                    {showAspectMenu && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowAspectMenu(false)} />
                                            <div className="absolute bottom-full left-0 mb-2 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_#000] overflow-hidden z-50 min-w-[140px]">
                                                {[
                                                    { value: '9:16', label: '9:16 Vertical', desc: 'TikTok/Reels' },
                                                    { value: '16:9', label: '16:9 Horizontal', desc: 'YouTube' },
                                                    { value: '1:1', label: '1:1 Square', desc: 'Instagram' }
                                                ].map((ar) => (
                                                    <button
                                                        key={ar.value}
                                                        onClick={() => { setAspectRatio(ar.value); setShowAspectMenu(false); }}
                                                        className={`w-full px-4 py-2 text-left transition-colors flex flex-col ${aspectRatio === ar.value ? 'bg-[var(--brand-primary)] text-black' : 'hover:bg-gray-100 text-gray-700'}`}
                                                    >
                                                        <span className="text-xs font-bold flex items-center justify-between w-full">
                                                            {ar.label}
                                                            {aspectRatio === ar.value && <span>✓</span>}
                                                        </span>
                                                        <span className={`text-[10px] ${aspectRatio === ar.value ? 'text-black/60' : 'text-gray-400'}`}>{ar.desc}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex-1"></div>

                                {/* Toggles */}
                                <div className="flex items-center gap-1 bg-gray-200/50 p-0.5 rounded-full">
                                    <button
                                        onClick={() => setPreviewMode('captions')}
                                        className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black transition-all ${enableCaptions ? 'bg-[var(--brand-primary)] text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
                                        title="Caption Style"
                                    >
                                        CC
                                    </button>
                                    <button
                                        onClick={() => setPreviewMode('music')}
                                        className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold transition-all ${enableBackgroundMusic ? 'bg-[var(--brand-primary)] text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
                                        title="Music"
                                    >
                                        ♫
                                    </button>
                                </div>

                            </div>

                            {/* B. Input Field */}
                            <div className="p-4">
                                <textarea
                                    ref={textareaRef}
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    disabled={isProcessing}
                                    placeholder="What would you like to create today?"
                                    className="w-full bg-transparent min-h-[80px] max-h-[160px] text-base font-medium placeholder:text-gray-300 focus:outline-none resize-none leading-relaxed overflow-y-auto"
                                    rows={2}
                                />
                            </div>

                            {/* C. Footer Actions */}
                            <div className="flex items-center justify-between gap-3 p-2 bg-gray-50 rounded-b-[var(--radius-lg)] border-t border-gray-100">

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={onEnhance}
                                        disabled={!inputText.trim() || isProcessing || isEnhancing}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:border-[var(--brand-primary)] hover:text-black hover:shadow-[2px_2px_0px_var(--brand-primary)] transition-all disabled:opacity-50 disabled:hover:shadow-none disabled:hover:border-gray-200"
                                    >
                                        <SparklesIcon className="w-3 h-3 text-purple-600" />
                                        <span>{isEnhancing ? 'Writing...' : 'Research'}</span>
                                    </button>

                                    <button
                                        onClick={onCollectAssets}
                                        disabled={!inputText.trim() || isProcessing || isCollectingAssets}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:border-blue-400 hover:text-black hover:shadow-[2px_2px_0px_#60A5FA] transition-all disabled:opacity-50 disabled:hover:shadow-none disabled:hover:border-gray-200"
                                    >
                                        <svg className="w-3 h-3 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                                        </svg>
                                        <span>{isCollectingAssets ? 'Finding...' : 'Collect'}</span>
                                    </button>
                                </div>

                                <button
                                    onClick={handleCreateVideo}
                                    disabled={!inputText.trim() || isProcessing}
                                    className="flex items-center gap-2 px-6 py-2 bg-[var(--brand-primary)] hover:bg-[#b3e600] text-black text-sm font-black rounded-lg border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_#000] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                                >
                                    <span>Generate</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                </button>

                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
