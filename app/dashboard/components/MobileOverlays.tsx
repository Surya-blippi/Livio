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
    onMakeStudioReady: () => void;
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
    const isDropUp = ['face', 'voice', 'duration', 'aspect'].includes(activeSheet || '');
    const isFullScreen = ['script', 'assets', 'storyboard', 'video', 'history'].includes(activeSheet || '');

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

                            {/* Face Selection */}
                            {activeSheet === 'face' && (() => {
                                // Filter out duplicate avatars by image_url
                                const uniqueAvatars = savedAvatars.filter((avatar, index, self) =>
                                    index === self.findIndex((a) => a.image_url === avatar.image_url)
                                );
                                return (
                                    <div className="p-4 pb-8">
                                        <h3 className="text-lg font-black mb-4 text-center">Video Style</h3>

                                        {/* Faceless Block */}
                                        <button
                                            onClick={() => { setMode('faceless'); onClose(); }}
                                            className={`w-full p-4 rounded-2xl border-2 mb-4 flex items-center gap-4 transition-all ${mode === 'faceless' ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10' : 'border-gray-200 hover:border-gray-300'}`}
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                <svg className="w-6 h-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="font-bold">Faceless</p>
                                                <p className="text-xs text-gray-500">Images only, no avatar</p>
                                            </div>
                                            {mode === 'faceless' && <span className="text-[var(--brand-primary)] text-xl">✓</span>}
                                        </button>

                                        {/* Current Look Preview & Actions */}
                                        {mode === 'face' && avatarUrl && (
                                            <div className="mb-4">
                                                <p className="text-sm font-bold text-gray-500 mb-2">Current Look</p>
                                                <div className="relative w-56 aspect-square mx-auto rounded-2xl border-2 border-[var(--brand-primary)] overflow-hidden shadow-sm bg-gray-100 group">
                                                    {/* Main Preview Image */}
                                                    <img
                                                        src={useStudioImage && studioReadyUrl ? studioReadyUrl : avatarUrl}
                                                        className="w-full h-full object-cover"
                                                        alt="Current Face"
                                                    />

                                                    {/* Gradient Overlay for Text Readability */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                                                    {/* Studio Badge (Top Right) */}
                                                    {useStudioImage && (
                                                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                                            <span>✨</span>
                                                            <span>Studio Ready</span>
                                                        </div>
                                                    )}

                                                    {/* Loading Overlay */}
                                                    {isGeneratingStudio && (
                                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                                                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-2" />
                                                            <p className="font-bold text-xs">Enhancing...</p>
                                                        </div>
                                                    )}

                                                    {/* Action Button Overlay (Bottom Right) */}
                                                    <div className="absolute bottom-2 right-2 z-10">
                                                        {!studioReadyUrl ? (
                                                            // Scenario 1: Enhance Button
                                                            <button
                                                                onClick={onMakeStudioReady}
                                                                disabled={isGeneratingStudio}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all"
                                                            >
                                                                <SparklesIcon className="w-3 h-3" />
                                                                Make Studio Ready
                                                            </button>
                                                        ) : (
                                                            // Scenario 2: Toggle Button (Compact)
                                                            <button
                                                                onClick={toggleStudioImage}
                                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-lg transition-all ${useStudioImage ? 'bg-white text-black border-white' : 'bg-black/50 text-white border-white/30 backdrop-blur-md'}`}
                                                            >
                                                                <span className="text-xs font-bold">
                                                                    {useStudioImage ? 'On' : 'Off'}
                                                                </span>
                                                                <div className={`w-6 h-3 rounded-full p-0.5 transition-colors ${useStudioImage ? 'bg-green-500' : 'bg-gray-400'}`}>
                                                                    <div className={`w-2 h-2 rounded-full bg-white shadow-sm transform transition-transform ${useStudioImage ? 'translate-x-3' : 'translate-x-0'}`} />
                                                                </div>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* With Face Label */}
                                        <p className="text-sm font-bold text-gray-500 mb-3">Choose from Library:</p>

                                        {/* Avatar Grid with Upload First */}
                                        <div className="grid grid-cols-4 gap-3 max-h-[200px] overflow-y-auto mb-4">
                                            {/* Upload Button - First */}
                                            <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--brand-primary)] hover:bg-gray-50 transition-all">
                                                <span className="text-2xl text-gray-400">+</span>
                                                <span className="text-[8px] text-gray-400 mt-1">Upload</span>
                                                <input type="file" accept="image/*" onChange={(e) => { onUploadAvatar(e); setMode('face'); }} className="hidden" />
                                            </label>

                                            {/* Unique Avatars */}
                                            {uniqueAvatars.map((avatar) => (
                                                <div key={avatar.id} className="relative group">
                                                    <button
                                                        onClick={() => { onSelectAvatar(avatar); setMode('face'); }}
                                                        className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all relative ${avatarUrl === avatar.image_url ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]' : 'border-gray-200 hover:border-gray-300'}`}
                                                    >
                                                        <img src={avatar.image_url} className="w-full h-full object-cover" alt="" />
                                                        {avatar.is_default && (
                                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent py-1">
                                                                <span className="text-[8px] text-white font-bold">✨ Studio</span>
                                                            </div>
                                                        )}
                                                    </button>
                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onDeleteAvatar(avatar.id); }}
                                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

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
                                                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
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

                                {/* Script View - Editable */}
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
