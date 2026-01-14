import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DbVoice, DbAvatar } from '@/lib/supabase';
import { MicIcon, PlayIcon, ImageIcon, SparklesIcon, VideoIcon, DownloadIcon } from '../icons';


// Define the modes this panel can be in
export type PreviewMode = 'idle' | 'face' | 'voice' | 'video' | 'assets' | 'script' | 'storyboard' | 'captions' | 'music';

interface PreviewPanelProps {
    previewMode: PreviewMode;
    setPreviewMode: (mode: PreviewMode) => void;

    // --- Data & Actions ---

    // Video Result
    videoUrl: string;
    aspectRatio: '9:16' | '16:9' | '1:1';

    // Face / Avatar
    mode: 'face' | 'faceless';
    setMode: (mode: 'face' | 'faceless') => void;
    photoPreview: string;
    handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    useStudioImage: boolean;
    studioReadyUrl: string;
    isGeneratingStudio: boolean;
    toggleStudioImage: () => void;
    onMakeStudioReady: () => void;
    onRemovePhoto: () => void;
    savedAvatars: DbAvatar[];
    onSelectAvatar: (avatar: DbAvatar) => void;

    // Voice
    allVoices: DbVoice[];
    savedVoice: DbVoice | null;
    isRecording: boolean;
    startRecording: () => void;
    stopRecording: () => void;
    handleVoiceUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onVoiceSelect: (voice: DbVoice) => void;
    hasClonedVoice: boolean;
    voiceFile: File | null;
    onClearVoice: () => void;
    onConfirmVoice: () => void;
    isConfirmingVoice: boolean;

    // Assets
    collectedAssets: Array<{ url: string; thumbnail?: string; title?: string; isUploaded?: boolean }>;
    onUploadAsset: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveAsset: (index: number) => void;

    // Script & Storyboard
    script?: string;
    setInputText?: (text: string) => void;
    onEnhance?: () => void;
    isEnhancing?: boolean;
    scenes?: Array<{ text: string; visual?: string }>;
    onRegenerateScenes?: () => void;
    isRegeneratingScenes?: boolean;

    // Captions
    enableCaptions: boolean;
    setEnableCaptions: (enabled: boolean) => void;
    captionStyle: string;
    setCaptionStyle: (style: string) => void;

    // Music
    enableBackgroundMusic: boolean;
    setEnableBackgroundMusic: (enabled: boolean) => void;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
    previewMode,
    setPreviewMode,
    videoUrl,
    aspectRatio,

    // Face
    mode, setMode,
    photoPreview, handlePhotoUpload,
    useStudioImage, studioReadyUrl, isGeneratingStudio, toggleStudioImage,
    onMakeStudioReady, onRemovePhoto,
    savedAvatars, onSelectAvatar,

    // Voice
    allVoices, savedVoice, onVoiceSelect,
    isRecording, startRecording, stopRecording, handleVoiceUpload,
    voiceFile, onClearVoice, onConfirmVoice, isConfirmingVoice,

    // Assets
    collectedAssets,
    onUploadAsset, onRemoveAsset,
    script,
    setInputText,
    onEnhance,
    isEnhancing,
    scenes,
    onRegenerateScenes,
    isRegeneratingScenes,

    // Captions
    enableCaptions, setEnableCaptions,
    captionStyle, setCaptionStyle,
    enableBackgroundMusic, setEnableBackgroundMusic
}) => {
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    // Music State
    const musicAudioRef = useRef<HTMLAudioElement | null>(null);
    const [isMusicPlaying, setIsMusicPlaying] = useState(false);

    // Stop music when switching modes or disabling
    useEffect(() => {
        if (previewMode !== 'music' || !enableBackgroundMusic) {
            if (musicAudioRef.current) {
                musicAudioRef.current.pause();
                musicAudioRef.current.currentTime = 0;
            }
            setIsMusicPlaying(false);
        }
    }, [previewMode, enableBackgroundMusic]);

    const togglePreview = (url: string | undefined, id: string) => {
        if (!url) return;

        if (playingVoice === id) {
            // Stop
            audioRef.current?.pause();
            setPlayingVoice(null);
        } else {
            // Play new
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = new Audio(url);
            } else {
                audioRef.current = new Audio(url);
            }

            // Clean up
            audioRef.current.onended = () => setPlayingVoice(null);
            audioRef.current.play().catch(err => console.error("Playback failed", err));
            setPlayingVoice(id);
        }
    };

    const renderContent = () => {
        switch (previewMode) {
            case 'video':
                // Get aspect ratio class based on current setting
                const getVideoContainerClass = () => {
                    switch (aspectRatio) {
                        case '16:9': return 'w-full max-w-md aspect-video';
                        case '1:1': return 'w-full max-w-xs aspect-square';
                        case '9:16':
                        default: return 'w-full max-w-[220px] aspect-[9/16]';
                    }
                };

                return (

                    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
                        <div className="flex-1 flex flex-col items-center justify-start md:justify-center p-4 md:p-8 animate-in fade-in zoom-in duration-300 min-h-min">
                            {videoUrl ? (
                                <>
                                    {/* Video Container - Adaptive to aspect ratio */}
                                    <div className={`${getVideoContainerClass()} bg-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_rgba(0,0,0,1)] border-3 border-black relative shrink-0`}>
                                        <video src={videoUrl} controls className="w-full h-full object-contain bg-black" playsInline />
                                    </div>

                                    {/* Info and Download Below */}
                                    <div className="mt-6 text-center space-y-4 w-full max-w-sm px-4 pb-8 md:pb-4">
                                        <div>
                                            <h3 className="font-black text-lg text-[var(--text-primary)]">Video Ready!</h3>
                                            <p className="text-xs text-[var(--text-secondary)] mt-1">
                                                {aspectRatio === '9:16' && 'Vertical (TikTok/Reels)'}
                                                {aspectRatio === '16:9' && 'Horizontal (YouTube)'}
                                                {aspectRatio === '1:1' && 'Square (Instagram)'}
                                            </p>
                                        </div>

                                        {/* Download Button - Extra prominent on mobile */}
                                        <a
                                            href={videoUrl}
                                            download={`video_${Date.now()}.mp4`}
                                            className="flex items-center justify-center gap-3 w-full px-6 py-5 md:py-4 bg-[var(--brand-primary)] text-black font-black text-base md:text-sm uppercase tracking-wider rounded-xl border-3 md:border-2 border-black shadow-[6px_6px_0px_#000] md:shadow-[4px_4px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
                                        >
                                            <DownloadIcon className="w-6 h-6 md:w-5 md:h-5" />
                                            <span>Download Video</span>
                                        </a>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center opacity-60 my-auto">
                                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                        <VideoIcon className="w-10 h-10 text-gray-400" />
                                    </div>
                                    <p className="text-sm text-gray-500">No video generated yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Click Generate to create your video</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'voice':
                return (
                    <div className="flex flex-col h-full animate-in slide-in-from-right duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
                            <h3 className="font-bold text-lg text-[var(--text-primary)]">Voice Selection</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">

                            {/* 1. Actions Row */}
                            <div className="flex gap-2">
                                {/* Upload Button */}
                                <label className="flex-1 flex flex-col items-center justify-center gap-2 p-3 border border-dashed border-[var(--border-subtle)] hover:border-[var(--brand-primary)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] rounded-lg cursor-pointer transition-all group">
                                    <div className="w-8 h-8 rounded-full bg-[var(--surface-3)] group-hover:bg-white flex items-center justify-center transition-colors">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                    </div>
                                    <span className="text-xs font-bold text-[var(--text-secondary)] group-hover:text-black">Upload Voice</span>
                                    <input type="file" accept="audio/*" onChange={handleVoiceUpload} className="hidden" />
                                </label>

                                {/* Record Button */}
                                <button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`flex-1 flex flex-col items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${isRecording ? 'border-red-500 bg-red-50' : 'border-[var(--border-subtle)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)]'}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse scale-110' : 'bg-[var(--surface-3)] text-[var(--text-secondary)]'}`}>
                                        {isRecording ? <div className="w-3 h-3 bg-white rounded-sm" /> : <MicIcon className="w-4 h-4" />}
                                    </div>
                                    <span className={`text-xs font-bold ${isRecording ? 'text-red-500' : 'text-[var(--text-secondary)]'}`}>
                                        {isRecording ? 'Stop Recording' : 'Tap to Record'}
                                    </span>
                                </button>
                            </div>

                            {/* 2. Active Voice Input Card (when voiceFile exists) */}
                            {voiceFile && (
                                <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--brand-primary)] animate-in slide-in-from-top-2 duration-300 relative">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)] text-black flex items-center justify-center shadow-sm flex-shrink-0">
                                            <MicIcon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-[var(--text-primary)] mb-0.5">Custom Voice</div>
                                            <div className="text-[10px] text-[var(--text-secondary)] truncate">{voiceFile.name}</div>
                                        </div>

                                        {/* Controls on the RIGHT */}
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => togglePreview(URL.createObjectURL(voiceFile), 'custom-file')}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-black text-white hover:scale-105 transition-transform"
                                                title="Play/Pause"
                                            >
                                                {playingVoice === 'custom-file' ? (
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                                ) : (
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                                )}
                                            </button>
                                            <button
                                                onClick={onClearVoice}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-500 transition-colors"
                                                title="Remove"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                            <button
                                                onClick={onConfirmVoice}
                                                disabled={isConfirmingVoice}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
                                                title="Confirm & Save Voice"
                                            >
                                                {isConfirmingVoice ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>


                                </div>
                            )}

                            {/* 3. Saved Voices List */}
                            <div className="space-y-1 pt-2">
                                <div className="px-1 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Your Voices</div>
                                {allVoices.map(voice => {
                                    const isPlaying = playingVoice === voice.id;
                                    const isSelected = savedVoice?.id === voice.id;
                                    return (
                                        <div
                                            key={voice.id}
                                            onClick={() => onVoiceSelect(voice)}
                                            className={`group flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${isSelected ? 'border-black bg-black text-white shadow-md' : 'border-transparent hover:bg-[var(--surface-2)] text-[var(--text-primary)]'}`}
                                        >
                                            {/* Icon */}
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border flex-shrink-0 ${isSelected ? 'bg-[var(--brand-primary)] text-black border-black' : 'bg-[var(--surface-3)] text-[var(--text-secondary)] border-transparent'}`}>
                                                {voice.name?.[0] || 'V'}
                                            </div>

                                            {/* Name */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold truncate">{voice.name}</div>
                                                <div className={`text-[10px] truncate ${isSelected ? 'text-gray-400' : 'text-[var(--text-tertiary)]'}`}>Custom Voice</div>
                                            </div>

                                            {/* Play Button (RIGHT SIDE) */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    togglePreview(voice.preview_url, voice.id);
                                                }}
                                                className={`w-8 h-8 flex items-center justify-center rounded-full transition-all flex-shrink-0 ${isSelected ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-400 hover:text-black'}`}
                                                title="Preview Voice"
                                            >
                                                {isPlaying ? (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                                ) : (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                                )}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                );

            case 'face':
                return (
                    <div className="flex flex-col h-full animate-in slide-in-from-right duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
                            <h3 className="font-bold text-lg text-[var(--text-primary)]">Visual Style</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {/* Unified Visual Style Grid */}
                            <div className="grid grid-cols-3 gap-3">
                                {/* None / Faceless Option */}
                                <button
                                    onClick={() => {
                                        setMode('faceless');
                                        onRemovePhoto();
                                    }}
                                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all flex flex-col items-center justify-center gap-2 ${mode === 'faceless' && !photoPreview ? 'border-black bg-gray-100 shadow-[4px_4px_0px_#000]' : 'border-gray-200 hover:border-gray-400 bg-[var(--surface-1)]'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${mode === 'faceless' && !photoPreview ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'}`}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                                        </svg>
                                    </div>
                                    <span className={`text-xs font-bold ${mode === 'faceless' && !photoPreview ? 'text-black' : 'text-gray-600'}`}>Faceless</span>
                                    <span className="text-[10px] text-gray-400">No Avatar</span>
                                    {mode === 'faceless' && !photoPreview && (
                                        <span className="absolute top-2 right-2 text-[10px] font-bold text-black bg-[var(--brand-primary)] px-1.5 py-0.5 rounded-full">✓</span>
                                    )}
                                </button>

                                {/* Upload New Photo */}
                                <label className={`relative aspect-square rounded-xl overflow-hidden border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group ${photoPreview && mode === 'face' ? 'border-gray-200' : 'border-gray-300 hover:border-[var(--brand-primary)]'}`}>
                                    <div className="w-10 h-10 rounded-full bg-gray-200 group-hover:bg-[var(--brand-primary)] flex items-center justify-center transition-colors">
                                        <span className="text-xl text-gray-500 group-hover:text-black">+</span>
                                    </div>
                                    <span className="text-xs font-bold text-gray-600">Upload</span>
                                    <span className="text-[10px] text-gray-400">Photo</span>
                                    <input type="file" accept="image/*" onChange={(e) => { handlePhotoUpload(e); setMode('face'); }} className="hidden" />
                                </label>

                                {/* Current Uploaded Photo - shown if photo exists but NOT in savedAvatars */}
                                {photoPreview && !savedAvatars?.some(a => a.image_url === photoPreview) && (
                                    <div
                                        onClick={() => setMode('face')}
                                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${mode === 'face' ? 'border-black shadow-[4px_4px_0px_#000]' : 'border-gray-200 hover:border-gray-400'}`}
                                    >
                                        <img src={photoPreview} className="w-full h-full object-cover" />

                                        {/* Remove button */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onRemovePhoto(); setMode('faceless'); }}
                                            className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        >
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>

                                        {/* Selected indicator */}
                                        {mode === 'face' && (
                                            <span className="absolute top-1.5 left-1.5 text-[10px] font-bold text-black bg-[var(--brand-primary)] px-1.5 py-0.5 rounded-full">✓ New</span>
                                        )}

                                        {/* Studio Ready Badge */}
                                        <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                            {useStudioImage ? (
                                                <span className="text-[10px] font-bold text-[var(--brand-primary)]">✨ Studio Ready</span>
                                            ) : (
                                                <span className="text-[10px] text-white/80">Your Photo</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Saved Avatars - deduplicated by image_url */}
                                {savedAvatars?.filter((avatar, index, self) =>
                                    index === self.findIndex(a => a.image_url === avatar.image_url)
                                ).map((avatar) => (
                                    <button
                                        key={avatar.id}
                                        onClick={() => { onSelectAvatar(avatar); setMode('face'); }}
                                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group ${photoPreview === avatar.image_url && mode === 'face' ? 'border-black shadow-[4px_4px_0px_#000]' : 'border-gray-200 hover:border-gray-400'}`}
                                    >
                                        <img src={avatar.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                        {photoPreview === avatar.image_url && mode === 'face' && (
                                            <span className="absolute top-1.5 left-1.5 text-[10px] font-bold text-black bg-[var(--brand-primary)] px-1.5 py-0.5 rounded-full">✓</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Studio Ready Enhancement Prompt - shown when photo uploaded but not enhanced */}
                            {photoPreview && !useStudioImage && mode === 'face' && (
                                <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                                            <SparklesIcon className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">Transform to Studio Ready</h4>
                                            <p className="text-xs text-[var(--text-secondary)] mb-3">
                                                Convert your photo into a professional AI-ready avatar for high-quality face videos.
                                            </p>
                                            <button
                                                onClick={onMakeStudioReady}
                                                disabled={isGeneratingStudio}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                            >
                                                <SparklesIcon className={`w-4 h-4 ${isGeneratingStudio ? 'animate-spin' : ''}`} />
                                                {isGeneratingStudio ? 'Enhancing...' : 'Make Studio Ready'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Faceless Mode Info - shown when None is selected */}
                            {mode === 'faceless' && (
                                <div className="mt-4 p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--border-subtle)]">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)]/20 flex items-center justify-center flex-shrink-0">
                                            <ImageIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">Faceless Mode</h4>
                                            <p className="text-xs text-[var(--text-secondary)]">
                                                Stock images and videos will be automatically selected based on your script. Review them in the <strong>Assets</strong> section.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'assets':
                return (
                    <div className="flex flex-col h-full animate-in slide-in-from-right duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
                            <h3 className="font-bold text-lg text-[var(--text-primary)]">Assets ({collectedAssets.length})</h3>
                            {/* Upload Button */}
                            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-black text-xs font-bold cursor-pointer border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path>
                                </svg>
                                Upload
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={onUploadAsset}
                                />
                            </label>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {collectedAssets.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {collectedAssets.map((asset, idx) => (
                                        <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border-2 border-gray-200 hover:border-black transition-colors group">
                                            <img
                                                src={asset.thumbnail || asset.url}
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Uploaded badge */}
                                            {asset.isUploaded && (
                                                <div className="absolute top-2 left-2 px-2 py-0.5 bg-[var(--brand-primary)] text-black text-[10px] font-bold rounded-full border border-black">
                                                    Uploaded
                                                </div>
                                            )}
                                            {/* Remove button */}
                                            <button
                                                onClick={() => onRemoveAsset(idx)}
                                                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 text-gray-500 hover:bg-red-100 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-gray-200"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-60">
                                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                        <ImageIcon className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-500 mb-2">No assets yet</p>
                                    <p className="text-xs text-gray-400 text-center max-w-[200px]">Use <strong>Collect</strong> to find images from the web, or upload your own.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'script':
                return (
                    <div className="flex flex-col h-full animate-in slide-in-from-right duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
                            <h3 className="font-bold text-lg text-[var(--text-primary)]">Video Script</h3>
                            {/* Write with AI Button */}
                            {onEnhance && (
                                <button
                                    onClick={onEnhance}
                                    disabled={isEnhancing}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold cursor-pointer shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                                >
                                    {isEnhancing ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Writing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <SparklesIcon className="w-3.5 h-3.5" />
                                            <span>Write with AI</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col">
                            {/* Editable Textarea */}
                            <textarea
                                value={script || ''}
                                onChange={(e) => setInputText?.(e.target.value)}
                                placeholder="Enter your script here or use 'Write with AI' to generate one from your topic..."
                                className="flex-1 w-full p-4 border-2 border-gray-200 rounded-xl text-base leading-relaxed resize-none focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 min-h-[300px] bg-white"
                            />
                            {/* Helper Text */}
                            <p className="text-xs text-[var(--text-tertiary)] mt-3 text-center">
                                ✏️ Edit directly or use AI to generate • This script will be used for video generation
                            </p>
                        </div>
                    </div>
                );

            case 'storyboard':
                return (
                    <div className="flex flex-col h-full animate-in slide-in-from-right duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
                            <h3 className="font-bold text-lg text-[var(--text-primary)]">Storyboard</h3>
                            {/* Refresh Storyboard Button */}
                            {onRegenerateScenes && (
                                <button
                                    onClick={onRegenerateScenes}
                                    disabled={isRegeneratingScenes}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold cursor-pointer shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                                >
                                    {isRegeneratingScenes ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Updating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            <span>Refresh from Script</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {scenes && scenes.length > 0 ? (
                                <div className="space-y-6">
                                    {scenes.map((scene, idx) => (
                                        <div key={idx} className="flex gap-4 p-4 border border-[var(--border-subtle)] rounded-xl bg-[var(--surface-1)]">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">
                                                {idx + 1}
                                            </div>
                                            <div className="space-y-2 flex-1">
                                                <div className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">Narration</div>
                                                <p className="text-sm font-medium">{scene.text}</p>
                                                {scene.visual && (
                                                    <div className="mt-3 p-3 bg-[var(--surface-3)] rounded-lg text-xs border border-[var(--border-subtle)]">
                                                        <span className="font-bold text-[var(--text-secondary)] block mb-1">VISUAL CUE</span>
                                                        {scene.visual}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-50 text-center">
                                    <div className="w-12 h-12 mb-4 border-2 border-dashed border-[var(--text-tertiary)] rounded-lg flex items-center justify-center">
                                        <span className="text-xl font-bold text-[var(--text-tertiary)]">1</span>
                                    </div>
                                    <p>No storyboard scenes yet.<br />Generate a script to see the breakdown.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'captions':
                return (
                    <div className="flex flex-col h-full animate-in slide-in-from-right duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
                            <h3 className="font-bold text-lg text-[var(--text-primary)]">Captions</h3>
                        </div>

                        <div className="flex-1 p-6 custom-scrollbar">
                            <div className="flex flex-col gap-4">
                                {/* Main Toggle Card */}
                                <div
                                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${enableCaptions ? 'border-black bg-[var(--surface-1)] shadow-[4px_4px_0px_#000]' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                                    onClick={() => {
                                        const newState = !enableCaptions;
                                        setEnableCaptions(newState);
                                        if (newState) {
                                            setCaptionStyle('bold-classic'); // Enforce Bangers style
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${enableCaptions ? 'bg-[var(--brand-primary)] text-black' : 'bg-gray-200 text-gray-400'}`}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M8 15h2" />
                                                <path d="M8 11h8" />
                                                <rect x="4" y="5" width="16" height="14" rx="2" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-[var(--text-primary)] mb-0.5">Dynamic Captions</h4>
                                            <p className="text-xs text-[var(--text-secondary)]">
                                                {enableCaptions ? 'Enabled (Pop Style)' : 'Add engaging captions to your video'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Toggle Switch Visual */}
                                    <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ${enableCaptions ? 'bg-green-500' : 'bg-gray-300'}`}>
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enableCaptions ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </div>

                                {/* Preview Visual (Only when enabled) */}
                                {enableCaptions && (
                                    <div className="mt-2 p-8 bg-black/90 rounded-xl border border-gray-800 flex items-center justify-center aspect-video relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20" />
                                        <div className="text-center z-10 animate-in zoom-in duration-300">
                                            <span
                                                className="text-4xl font-black text-white leading-tight block transform -rotate-2"
                                                style={{
                                                    fontFamily: '"Impact", "Arial Black", sans-serif',
                                                    textShadow: '3px 3px 0 #000, -1px -1px 0 #000'
                                                }}
                                            >
                                                <span className="text-[#FFD700]">DYNAMIC</span> CAPTIONS
                                            </span>
                                            <span
                                                className="text-xl font-bold text-white mt-2 block"
                                                style={{
                                                    textShadow: '2px 2px 0 #000'
                                                }}
                                            >
                                                ARE ENABLED!
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 'music':
                return (
                    <div className="flex flex-col h-full animate-in slide-in-from-right duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
                            <h3 className="font-bold text-lg text-[var(--text-primary)]">Background Music</h3>
                        </div>

                        <div className="flex-1 p-6 custom-scrollbar">
                            <div className="flex flex-col gap-4">
                                {/* Toggle Card */}
                                <div
                                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${enableBackgroundMusic ? 'border-black bg-[var(--surface-1)] shadow-[4px_4px_0px_#000]' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                                    onClick={() => setEnableBackgroundMusic(!enableBackgroundMusic)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${enableBackgroundMusic ? 'bg-[var(--brand-primary)] text-black' : 'bg-gray-200 text-gray-400'}`}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M9 18V5l12-2v13" />
                                                <circle cx="6" cy="18" r="3" />
                                                <circle cx="18" cy="16" r="3" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-[var(--text-primary)] mb-0.5">Background Music</h4>
                                            <p className="text-xs text-[var(--text-secondary)]">
                                                {enableBackgroundMusic ? 'Enabled' : 'Add atmosphere to your video'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Toggle Switch */}
                                    <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ${enableBackgroundMusic ? 'bg-green-500' : 'bg-gray-300'}`}>
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enableBackgroundMusic ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </div>

                                {/* Preview Card */}
                                {enableBackgroundMusic && (
                                    <div className="mt-2 p-6 bg-[#0F172A] rounded-xl border border-gray-800 text-white shadow-lg animate-in zoom-in duration-200">
                                        <div className="flex items-center gap-5">
                                            {/* Album Art */}
                                            <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-inner">
                                                <span className="text-4xl filter drop-shadow-md">🎵</span>
                                            </div>

                                            {/* Info & Controls */}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-lg mb-0.5 text-white">Feeling Blue</h4>
                                                <p className="text-xs text-indigo-200 mb-3">Upbeat • Pop • Energetic</p>

                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const audio = musicAudioRef.current;
                                                            if (!audio) return;

                                                            if (isMusicPlaying) {
                                                                audio.pause();
                                                                setIsMusicPlaying(false);
                                                            } else {
                                                                audio.play().catch(e => console.error("Play error:", e));
                                                                setIsMusicPlaying(true);
                                                            }
                                                        }}
                                                        className="w-10 h-10 rounded-full bg-white text-indigo-900 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow shadow-indigo-500/20"
                                                    >
                                                        {isMusicPlaying ? (
                                                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                                                        ) : (
                                                            <PlayIcon className="w-5 h-5 ml-1" />
                                                        )}
                                                    </button>

                                                    {/* Audio Element */}
                                                    <audio
                                                        ref={musicAudioRef}
                                                        src="/Feeling Blue.mp3"
                                                        onEnded={() => setIsMusicPlaying(false)}
                                                        onPause={() => setIsMusicPlaying(false)}
                                                        onPlay={() => setIsMusicPlaying(true)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 'idle':
            default:
                return (
                    <div className="flex flex-col h-full items-center justify-center text-center p-8 opacity-60">
                        <div className="w-24 h-24 rounded-[var(--radius-xl)] bg-[var(--brand-primary)] mb-6 shadow-[8px_8px_0px_#000] border-2 border-black flex items-center justify-center rotate-3 hover:rotate-6 transition-transform">
                            <SparklesIcon className="w-12 h-12 text-black" />
                        </div>
                        <h3 className="heading-section text-[var(--text-primary)] mb-2">Create Something Amazing</h3>
                        <p className="max-w-xs text-body">
                            Select an <strong>Avatar</strong> or <strong>Voice</strong> to customize your video. The preview will appear here.
                        </p>
                    </div>
                );
        }
    };

    return (
        <div className="h-full w-full bg-transparent border-none shadow-none relative overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.div
                    key={previewMode}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                >
                    {renderContent()}
                </motion.div>
            </AnimatePresence>

            {/* Fixed Mobile Download Button - Always visible at bottom on mobile when video is ready */}
            {previewMode === 'video' && videoUrl && (
                <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-gradient-to-t from-white via-white to-transparent md:hidden z-50">
                    <a
                        href={videoUrl}
                        download={`video_${Date.now()}.mp4`}
                        className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-[var(--brand-primary)] text-black font-black text-base uppercase tracking-wider rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                    >
                        <DownloadIcon className="w-6 h-6" />
                        <span>Download Video</span>
                    </a>
                </div>
            )}
        </div>
    );
};
