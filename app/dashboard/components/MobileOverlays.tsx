'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon, MicIcon, ImageIcon, ClockIcon, VideoIcon, SparklesIcon } from './icons';

// ========== TYPES ==========
export type MobileSheetType =
    | 'face'
    | 'voice'
    | 'duration'
    | 'aspect'
    | 'editType'
    | 'script'
    | 'assets'
    | 'storyboard'
    | 'video'
    | 'history'
    | null;

interface Avatar {
    id: string;
    image_url: string;
    name?: string;
    is_default?: boolean;
}

interface Voice {
    id?: string;  // DB id for user's cloned voices
    voice_id: string;
    name: string;
    preview_url?: string;
    labels?: { accent?: string };
}

interface Asset {
    url: string;
    thumbnail: string;
    title: string;
    source: string;
}

interface Scene {
    text: string;
    keywords?: string[];
    assetUrl?: string;
}

interface VideoHistory {
    id: string;
    video_url: string;
    created_at: string;
    topic?: string;
}

// ========== PROPS ==========
interface MobileOverlaysProps {
    activeSheet: MobileSheetType;
    onClose: () => void;

    // Face
    mode: 'face' | 'faceless';
    setMode: (m: 'face' | 'faceless') => void;
    avatarUrl?: string;
    savedAvatars: Avatar[];
    onSelectAvatar: (avatar: Avatar) => void;
    onUploadAvatar: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onDeleteAvatar: (avatarId: string) => void;

    // Studio Ready
    useStudioImage: boolean;
    studioReadyUrl?: string;
    isGeneratingStudio: boolean;
    onMakeStudioReady: (style?: string) => void;
    toggleStudioImage: () => void;

    // Voice
    voices: Voice[];
    selectedVoice?: Voice;
    onSelectVoice: (voice: Voice) => void;
    isRecording: boolean;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onUploadVoice: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onDeleteVoice: (voiceDbId: string) => void;
    voiceFile?: File | null;
    onConfirmVoice: () => void;
    onClearVoice: () => void;
    isConfirmingVoice: boolean;
    hasClonedVoice?: boolean;

    // Duration
    duration: number;
    setDuration: (d: number) => void;

    // Aspect
    aspectRatio: string;
    setAspectRatio: (r: string) => void;

    // Edit Type
    editType: 'minimal' | 'motion' | 'typography';
    setEditType: (type: 'minimal' | 'motion' | 'typography') => void;

    // Script
    script: string;
    setInputText: (text: string) => void;
    onEnhance: () => void;
    isEnhancing?: boolean;

    // Assets
    assets: Asset[];
    onUploadAsset: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveAsset: (index: number) => void;

    // Storyboard
    scenes: Scene[];
    onRegenerateScenes: () => void;
    isRegeneratingScenes?: boolean;

    // Video
    videoUrl?: string;

    // History
    videoHistory: VideoHistory[];
    onSelectVideo: (video: VideoHistory) => void;
    onDeleteVideo: (id: string) => void;
}

// ========== COMPONENT ==========
export const MobileOverlays: React.FC<MobileOverlaysProps> = ({
    activeSheet,
    onClose,
    mode,
    setMode,
    avatarUrl,
    savedAvatars,
    onSelectAvatar,
    onUploadAvatar,
    onDeleteAvatar,
    useStudioImage,
    studioReadyUrl,
    isGeneratingStudio,
    onMakeStudioReady,
    toggleStudioImage,
    voices,
    selectedVoice,
    onSelectVoice,
    isRecording,
    onStartRecording,
    onStopRecording,
    onUploadVoice,
    onDeleteVoice,
    voiceFile,
    onConfirmVoice,
    onClearVoice,
    isConfirmingVoice,
    hasClonedVoice,
    duration,
    setDuration,
    aspectRatio,
    setAspectRatio,
    editType,
    setEditType,
    script,
    setInputText,
    onEnhance,
    isEnhancing,
    assets,
    onUploadAsset,
    onRemoveAsset,
    scenes,
    onRegenerateScenes,
    isRegeneratingScenes,
    videoUrl,
    videoHistory,
    onSelectVideo,
    onDeleteVideo
}) => {
    const isDropUp = ['voice', 'duration', 'aspect', 'editType'].includes(activeSheet || '');
    const isFullScreen = ['face', 'script', 'assets', 'storyboard', 'video', 'history'].includes(activeSheet || '');

    return (
        <AnimatePresence>
            {activeSheet && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Drop-Up Sheets (small, from bottom) */}
                    {isDropUp && (
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[28px] z-50 max-h-[70vh] overflow-hidden"
                        >
                            {/* Handle */}
                            <div className="flex justify-center py-2">
                                <div className="w-10 h-1 bg-gray-300 rounded-full" />
                            </div>

                            {/* Voice Selection */}
                            {activeSheet === 'voice' && (() => {
                                // State for playing audio
                                const [playingVoiceId, setPlayingVoiceId] = React.useState<string | null>(null);
                                const audioRef = useRef<HTMLAudioElement | null>(null);

                                const handlePlayVoice = (voiceId: string, previewUrl?: string) => {
                                    if (playingVoiceId === voiceId) {
                                        // Stop playing
                                        audioRef.current?.pause();
                                        setPlayingVoiceId(null);
                                    } else {
                                        // Start playing
                                        audioRef.current?.pause();
                                        if (previewUrl) {
                                            const audio = new Audio(previewUrl);
                                            audioRef.current = audio;
                                            audio.play();
                                            audio.onended = () => setPlayingVoiceId(null);
                                            setPlayingVoiceId(voiceId);
                                        }
                                    }
                                };

                                return (
                                    <div className="p-4 pb-8">
                                        <h3 className="text-lg font-black mb-4 text-center">Choose Voice</h3>

                                        {/* Voice Onboarding Banner - Show when no cloned voice */}
                                        {!hasClonedVoice && !voiceFile && (
                                            <div className="mb-4 p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl border-2 border-green-300">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 animate-pulse">
                                                        <span className="text-white text-sm">🎤</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-green-800 text-sm mb-0.5">
                                                            Clone your voice!
                                                        </h4>
                                                        <p className="text-xs text-green-700">
                                                            Record 10-30 seconds reading any text naturally. We'll clone your voice for all future videos.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Recorded/Uploaded Voice Preview */}
                                        {voiceFile && (
                                            <div className="mb-4 p-3 rounded-xl border-2 border-purple-300 bg-purple-50">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                                        <MicIcon className="w-4 h-4 text-white" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm">Your Voice</p>
                                                        <p className="text-xs text-purple-600 truncate">{voiceFile.name}</p>
                                                    </div>

                                                    {/* Controls: Play, Cancel, Confirm */}
                                                    <div className="flex items-center gap-2">
                                                        {/* Play Button */}
                                                        <button
                                                            onClick={() => {
                                                                const url = URL.createObjectURL(voiceFile);
                                                                handlePlayVoice('uploaded', url);
                                                            }}
                                                            className="w-8 h-8 rounded-full bg-white border border-purple-200 text-purple-600 flex items-center justify-center hover:bg-purple-100"
                                                        >
                                                            {playingVoiceId === 'uploaded' ? (
                                                                <span className="text-sm">⏹</span>
                                                            ) : (
                                                                <span className="text-sm">▶</span>
                                                            )}
                                                        </button>

                                                        {/* Cancel Button */}
                                                        <button
                                                            onClick={onClearVoice}
                                                            className="w-8 h-8 rounded-full bg-white border border-red-200 text-red-500 flex items-center justify-center hover:bg-red-50"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>

                                                        {/* Confirm (Tick) Button */}
                                                        <button
                                                            onClick={onConfirmVoice}
                                                            disabled={isConfirmingVoice}
                                                            className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md hover:bg-green-600 disabled:opacity-50"
                                                        >
                                                            {isConfirmingVoice ? (
                                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                            ) : (
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Record/Upload Actions */}
                                        <div className="flex gap-3 mb-4">
                                            <button
                                                onClick={isRecording ? onStopRecording : onStartRecording}
                                                className={`flex-1 py-3 rounded-xl border-2 font-bold flex items-center justify-center gap-2 ${isRecording ? 'border-red-500 bg-red-50 text-red-600 animate-pulse' : 'border-gray-200'}`}
                                            >
                                                <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500' : 'bg-gray-400'}`} />
                                                {isRecording ? 'Recording...' : 'Record'}
                                            </button>
                                            <label className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-50">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                                <span>Upload</span>
                                                <input type="file" accept="audio/*" onChange={onUploadVoice} className="hidden" />
                                            </label>
                                        </div>

                                        {/* Voice List with Play Buttons */}
                                        <p className="text-sm font-bold text-gray-500 mb-3">Or choose a voice:</p>
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                            {voices.map((voice) => (
                                                <div
                                                    key={voice.id || voice.voice_id}
                                                    className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all relative group ${selectedVoice?.voice_id === voice.voice_id ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10' : 'border-gray-200'}`}
                                                >
                                                    {/* Play Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handlePlayVoice(voice.voice_id, voice.preview_url);
                                                        }}
                                                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${playingVoiceId === voice.voice_id ? 'bg-[var(--brand-primary)] text-black' : 'bg-gradient-to-br from-green-400 to-emerald-500 text-white'}`}
                                                    >
                                                        {playingVoiceId === voice.voice_id ? (
                                                            <span className="text-sm font-bold">⏹</span>
                                                        ) : (
                                                            <span className="text-sm">▶</span>
                                                        )}
                                                    </button>

                                                    {/* Voice Info - Clickable to Select */}
                                                    <button
                                                        onClick={() => { onSelectVoice(voice); onClose(); }}
                                                        className="flex-1 text-left"
                                                    >
                                                        <p className="font-bold">{voice.name}</p>
                                                        {voice.id ? (
                                                            <p className="text-xs text-gray-400">Custom Voice</p>
                                                        ) : (
                                                            voice.labels?.accent && <p className="text-xs text-gray-500">{voice.labels.accent}</p>
                                                        )}
                                                    </button>

                                                    {/* Checkmark */}
                                                    {selectedVoice?.voice_id === voice.voice_id && (
                                                        <span className="text-[var(--brand-primary)] text-xl">✓</span>
                                                    )}

                                                    {/* Delete Button - only for user's cloned voices (have DB id) */}
                                                    {voice.id && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onDeleteVoice(voice.id!); }}
                                                            className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-sm opacity-0 group-hover:opacity-100 md:opacity-0 active:opacity-100 transition-opacity shadow-lg touch-manipulation"
                                                            aria-label="Delete voice"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Duration Selection */}
                            {activeSheet === 'duration' && (
                                <div className="p-4 pb-8">
                                    <h3 className="text-lg font-black mb-4 text-center">Duration</h3>
                                    <div className="flex gap-3">
                                        {[15, 30, 60].map((d) => (
                                            <button
                                                key={d}
                                                onClick={() => { setDuration(d); onClose(); }}
                                                className={`flex-1 py-6 rounded-2xl border-2 font-black text-xl transition-all ${duration === d ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-black' : 'border-gray-200'}`}
                                            >
                                                {d}s
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Edit Type Selection */}
                            {activeSheet === 'editType' && (
                                <div className="p-4 pb-8">
                                    <h3 className="text-lg font-black mb-4 text-center">Edit Type</h3>
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={() => { setEditType('minimal'); onClose(); }}
                                            className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${editType === 'minimal' ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10' : 'border-gray-200 hover:border-gray-300'}`}
                                        >
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${editType === 'minimal' ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'}`}>
                                                <svg className={`w-6 h-6 ${editType === 'minimal' ? 'text-black' : 'text-gray-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                    <line x1="9" y1="3" x2="9" y2="21"></line>
                                                </svg>
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="font-bold text-base">Minimal</p>
                                                <p className="text-xs text-gray-500">Fast • Avatar only</p>
                                            </div>
                                            {editType === 'minimal' && <span className="text-[var(--brand-primary)] text-xl">✓</span>}
                                        </button>
                                        <button
                                            onClick={() => { setEditType('motion'); onClose(); }}
                                            className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${editType === 'motion' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}
                                        >
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${editType === 'motion' ? 'bg-purple-500' : 'bg-gray-200'}`}>
                                                <svg className={`w-6 h-6 ${editType === 'motion' ? 'text-white' : 'text-gray-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                                </svg>
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="font-bold text-base">Motion ✨</p>
                                                <p className="text-xs text-gray-500">AI visuals per scene</p>
                                            </div>
                                            {editType === 'motion' && <span className="text-purple-500 text-xl">✓</span>}
                                        </button>
                                        <button
                                            onClick={() => { setEditType('typography'); setMode('faceless'); onClose(); }}
                                            className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${editType === 'typography' ? 'border-pink-500 bg-pink-50' : 'border-gray-200 hover:border-gray-300'}`}
                                        >
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${editType === 'typography' ? 'bg-pink-500' : 'bg-gray-200'}`}>
                                                <svg className={`w-6 h-6 ${editType === 'typography' ? 'text-white' : 'text-gray-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="4 7 4 4 20 4 20 7"></polyline>
                                                    <line x1="9" y1="20" x2="15" y2="20"></line>
                                                    <line x1="12" y1="4" x2="12" y2="20"></line>
                                                </svg>
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="font-bold text-base">Typography ✏️</p>
                                                <p className="text-xs text-gray-500">Animated text on screen</p>
                                            </div>
                                            {editType === 'typography' && <span className="text-pink-500 text-xl">✓</span>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Aspect Ratio Selection */}
                            {activeSheet === 'aspect' && (
                                <div className="p-4 pb-8">
                                    <h3 className="text-lg font-black mb-4 text-center">Aspect Ratio</h3>
                                    <div className="flex gap-3">
                                        {[
                                            { value: '9:16', icon: 'h-12 w-7' },
                                            { value: '16:9', icon: 'h-7 w-12' },
                                            { value: '1:1', icon: 'h-10 w-10' }
                                        ].map((ar) => (
                                            <button
                                                key={ar.value}
                                                onClick={() => { setAspectRatio(ar.value); onClose(); }}
                                                className={`flex-1 py-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${aspectRatio === ar.value ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10' : 'border-gray-200'}`}
                                            >
                                                <div className={`${ar.icon} border-2 ${aspectRatio === ar.value ? 'border-[var(--brand-primary)]' : 'border-gray-400'} rounded`} />
                                                <span className="font-bold text-sm">{ar.value}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )
                    }

                    {/* Full Screen Sheets */}
                    {isFullScreen && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed inset-0 bg-white z-50 flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                                <h2 className="text-xl font-black capitalize">{activeSheet}</h2>
                                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                                    <CloseIcon className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-4">

                                {/* Face Selection - Full Screen */}
                                {activeSheet === 'face' && (() => {
                                    const uniqueAvatars = savedAvatars.filter((avatar, index, self) =>
                                        index === self.findIndex((a) => a.image_url === avatar.image_url)
                                    );
                                    return (
                                        <div className="space-y-6">
                                            {/* Mode Selection */}
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-500 mb-3">Video Style</h3>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => { setMode('face'); }}
                                                        className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${mode === 'face' ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10' : 'border-gray-200'}`}
                                                    >
                                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                                            <span className="text-2xl">👤</span>
                                                        </div>
                                                        <span className="font-bold">With Face</span>
                                                        {mode === 'face' && <span className="text-[var(--brand-primary)]">✓</span>}
                                                    </button>
                                                    <button
                                                        onClick={() => { setMode('faceless'); onClose(); }}
                                                        className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${mode === 'faceless' ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10' : 'border-gray-200'}`}
                                                    >
                                                        <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center">
                                                            <svg className="w-6 h-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <circle cx="12" cy="12" r="10" />
                                                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                                            </svg>
                                                        </div>
                                                        <span className="font-bold">Faceless</span>
                                                        {mode === 'faceless' && <span className="text-[var(--brand-primary)]">✓</span>}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Onboarding Banner - Show when no avatar is selected */}
                                            {mode === 'face' && !avatarUrl && !studioReadyUrl && uniqueAvatars.length === 0 && (
                                                <div className="mt-6 mb-2 p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl border-2 border-purple-300">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 animate-pulse">
                                                            <span className="text-white text-lg">✨</span>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-purple-800 text-sm mb-1">
                                                                Let's get you studio ready!
                                                            </h4>
                                                            <p className="text-xs text-purple-700">
                                                                Upload your photo and we'll transform it into a professional AI-ready avatar. <strong>This is a one-time setup.</strong>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Faceless Mode Info - shown when Faceless is selected */}
                                            {mode === 'faceless' && (
                                                <div className="mt-6 mb-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)]/20 flex items-center justify-center flex-shrink-0">
                                                            <ImageIcon className="w-4 h-4 text-gray-500" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-gray-900 text-sm mb-1">Faceless Mode</h4>
                                                            <p className="text-xs text-gray-600">
                                                                Stock images and videos will be automatically selected based on your script. Review them in the <strong>Assets</strong> section.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {mode === 'face' && (
                                                <>
                                                    {/* Current Avatar Preview */}
                                                    {avatarUrl && (
                                                        <div>
                                                            <h3 className="text-sm font-bold text-gray-500 mb-3">Current Avatar</h3>
                                                            <div className="relative w-40 aspect-[9/16] mx-auto rounded-2xl border-2 border-[var(--brand-primary)] overflow-hidden shadow-lg">
                                                                <img
                                                                    src={useStudioImage && studioReadyUrl ? studioReadyUrl : avatarUrl}
                                                                    className="w-full h-full object-cover"
                                                                    alt="Current Avatar"
                                                                />
                                                                {useStudioImage && (
                                                                    <div className="absolute top-2 right-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                                                                        ✨ Studio
                                                                    </div>
                                                                )}
                                                                {isGeneratingStudio && (
                                                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                                                                        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2" />
                                                                        <p className="text-white font-bold text-sm">Enhancing...</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Studio Ready Style Options */}
                                                    {avatarUrl && !studioReadyUrl && (
                                                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-200">
                                                            <h3 className="text-base font-bold mb-2 flex items-center gap-2">
                                                                <span className="text-lg">✨</span> Make Studio Ready
                                                            </h3>
                                                            <p className="text-xs text-gray-600 mb-4">
                                                                Transform your photo into a professional AI-ready avatar. Choose a style:
                                                            </p>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {[
                                                                    { id: 'podcaster', label: 'Podcaster', emoji: '🎙️', desc: 'With microphone' },
                                                                    { id: 'casual', label: 'Casual', emoji: '😊', desc: 'Friendly look' },
                                                                    { id: 'trendy', label: 'Trendy', emoji: '✨', desc: 'Modern style' },
                                                                    { id: 'minimal', label: 'Minimal', emoji: '🤍', desc: 'Clean & simple' }
                                                                ].map((style) => (
                                                                    <button
                                                                        key={style.id}
                                                                        onClick={() => onMakeStudioReady(style.id)}
                                                                        disabled={isGeneratingStudio}
                                                                        className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:shadow-md transition-all disabled:opacity-50"
                                                                    >
                                                                        <span className="text-2xl">{style.emoji}</span>
                                                                        <div className="text-left">
                                                                            <p className="text-sm font-bold">{style.label}</p>
                                                                            <p className="text-[10px] text-gray-500">{style.desc}</p>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Toggle Studio Image if already created */}
                                                    {studioReadyUrl && (
                                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                                            <div>
                                                                <p className="font-bold">Use Studio Ready</p>
                                                                <p className="text-xs text-gray-500">AI-enhanced avatar</p>
                                                            </div>
                                                            <button
                                                                onClick={toggleStudioImage}
                                                                className={`w-12 h-6 rounded-full p-1 transition-colors ${useStudioImage ? 'bg-purple-500' : 'bg-gray-300'}`}
                                                            >
                                                                <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${useStudioImage ? 'translate-x-6' : 'translate-x-0'}`} />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Avatar Library */}
                                                    <div>
                                                        <h3 className="text-sm font-bold text-gray-500 mb-3">Your Avatars</h3>
                                                        <div className="grid grid-cols-3 gap-3">
                                                            {/* Upload Button */}
                                                            <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--brand-primary)] hover:bg-gray-50 transition-all">
                                                                <span className="text-3xl text-gray-400">+</span>
                                                                <span className="text-xs text-gray-400 mt-1">Upload</span>
                                                                <input type="file" accept="image/*" onChange={(e) => { onUploadAvatar(e); setMode('face'); }} className="hidden" />
                                                            </label>

                                                            {/* Avatar Grid */}
                                                            {uniqueAvatars.map((avatar) => (
                                                                <div key={avatar.id} className="relative group">
                                                                    <button
                                                                        onClick={() => { onSelectAvatar(avatar); setMode('face'); }}
                                                                        className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${avatarUrl === avatar.image_url ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]' : 'border-gray-200'}`}
                                                                    >
                                                                        <img src={avatar.image_url} className="w-full h-full object-cover" alt="" />
                                                                        {avatar.is_default && (
                                                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent py-1 px-2">
                                                                                <span className="text-[10px] text-white font-bold">✨ Studio</span>
                                                                            </div>
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); onDeleteAvatar(avatar.id); }}
                                                                        className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {/* Onboarding if no avatars */}
                                            {mode === 'face' && uniqueAvatars.length === 0 && !avatarUrl && (
                                                <div className="text-center py-8">
                                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mx-auto mb-4 flex items-center justify-center">
                                                        <span className="text-4xl">📷</span>
                                                    </div>
                                                    <h3 className="text-lg font-bold mb-2">Upload Your Photo</h3>
                                                    <p className="text-sm text-gray-500 mb-4">We'll transform it into an AI-ready avatar</p>
                                                    <label className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-bold rounded-xl cursor-pointer hover:bg-gray-800 transition-colors">
                                                        <span>Choose Photo</span>
                                                        <input type="file" accept="image/*" onChange={(e) => { onUploadAvatar(e); setMode('face'); }} className="hidden" />
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                                {activeSheet === 'script' && (
                                    <div className="h-full flex flex-col">
                                        {/* Write with AI Button */}
                                        <div className="flex gap-2 mb-4">
                                            <button
                                                onClick={() => { onEnhance(); }}
                                                disabled={isEnhancing || !script}
                                                className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                                            >
                                                {isEnhancing ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                        <span>Writing...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <SparklesIcon className="w-4 h-4" />
                                                        <span>Write with AI</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* Editable Script Textarea */}
                                        <textarea
                                            value={script}
                                            onChange={(e) => setInputText(e.target.value)}
                                            placeholder="Enter your script here or use 'Write with AI' to generate one from your topic..."
                                            className="flex-1 w-full p-4 border-2 border-gray-200 rounded-xl text-base leading-relaxed resize-none focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
                                            style={{ minHeight: '300px' }}
                                        />

                                        {/* Helper Text */}
                                        <p className="text-xs text-gray-500 mt-2 text-center">
                                            This script will be used for video generation
                                        </p>
                                    </div>
                                )}

                                {/* Assets View */}
                                {activeSheet === 'assets' && (
                                    <div>
                                        <label className="flex items-center justify-center gap-2 p-4 mb-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-400">
                                            <ImageIcon className="w-5 h-5 text-gray-400" />
                                            <span className="font-bold text-gray-500">Upload Images</span>
                                            <input type="file" accept="image/*" multiple onChange={onUploadAsset} className="hidden" />
                                        </label>

                                        {assets.length > 0 ? (
                                            <div className="grid grid-cols-3 gap-2">
                                                {assets.map((asset, i) => (
                                                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                                                        <img src={asset.thumbnail} className="w-full h-full object-cover" />
                                                        <button
                                                            onClick={() => onRemoveAsset(i)}
                                                            className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                                                        >
                                                            <CloseIcon className="w-3 h-3 text-white" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-gray-400 text-center py-8">No assets collected yet. Click Collect to find images.</p>
                                        )}
                                    </div>
                                )}

                                {/* Storyboard View */}
                                {activeSheet === 'storyboard' && (
                                    <div className="space-y-4">
                                        {/* Refresh Button */}
                                        <button
                                            onClick={onRegenerateScenes}
                                            disabled={isRegeneratingScenes}
                                            className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
                                        >
                                            {isRegeneratingScenes ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    <span>Updating...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                    <span>Refresh from Script</span>
                                                </>
                                            )}
                                        </button>

                                        {scenes.length > 0 ? (
                                            scenes.map((scene, i) => (
                                                <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                                                        <span className="text-xs text-gray-500">Scene {i + 1}</span>
                                                    </div>
                                                    <p className="text-sm">{scene.text}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-400 text-center py-8">No storyboard yet. Generate a script first.</p>
                                        )}
                                    </div>
                                )}

                                {/* Video Preview */}
                                {activeSheet === 'video' && (
                                    <div className="flex flex-col items-center justify-center min-h-[60vh]">
                                        {videoUrl ? (
                                            <>
                                                <video
                                                    src={videoUrl}
                                                    controls
                                                    autoPlay
                                                    className="w-full max-w-sm rounded-2xl shadow-2xl"
                                                    style={{ aspectRatio: '9/16' }}
                                                />
                                                {/* Download Button */}
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const response = await fetch(videoUrl);
                                                            const blob = await response.blob();
                                                            const url = window.URL.createObjectURL(blob);
                                                            const a = document.createElement('a');
                                                            a.href = url;
                                                            a.download = `video_${Date.now()}.mp4`;
                                                            document.body.appendChild(a);
                                                            a.click();
                                                            document.body.removeChild(a);
                                                            window.URL.revokeObjectURL(url);
                                                        } catch (err) {
                                                            // Fallback: open in new tab
                                                            window.open(videoUrl, '_blank');
                                                        }
                                                    }}
                                                    className="mt-6 flex items-center justify-center gap-3 w-full max-w-sm px-6 py-4 bg-[var(--brand-primary)] text-black font-black text-base uppercase tracking-wider rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                                                >
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                    <span>Download Video</span>
                                                </button>
                                            </>
                                        ) : (
                                            <div className="text-center py-12">
                                                <VideoIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                                                <p className="text-gray-400">No video generated yet</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* History View */}
                                {activeSheet === 'history' && (
                                    <div className="space-y-3">
                                        {videoHistory.length > 0 ? (
                                            videoHistory.map((video) => (
                                                <button
                                                    key={video.id}
                                                    onClick={() => { onSelectVideo(video); onClose(); }}
                                                    className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3 text-left"
                                                >
                                                    <div className="w-16 h-24 bg-black rounded-lg overflow-hidden flex-shrink-0">
                                                        {video.video_url ? (
                                                            <video src={video.video_url} className="w-full h-full object-cover" muted />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">No preview</div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold truncate">{video.topic || 'Untitled'}</p>
                                                        <p className="text-xs text-gray-500">{new Date(video.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <p className="text-gray-400 text-center py-8">No videos yet</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </>
            )}
        </AnimatePresence>
    );
};
