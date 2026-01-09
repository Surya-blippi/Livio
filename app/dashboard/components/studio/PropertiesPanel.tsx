import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DbVoice, DbAvatar } from '@/lib/supabase';
import { MicIcon, PlayIcon, ImageIcon, SparklesIcon, VideoIcon } from '../icons';

interface PropertiesPanelProps {
    // Core
    mode: 'face' | 'faceless';
    setMode: (mode: 'face' | 'faceless') => void;
    duration: number;
    setDuration: (d: number) => void;
    aspectRatio: '9:16' | '16:9' | '1:1';
    setAspectRatio: (ar: '9:16' | '16:9' | '1:1') => void;
    enableCaptions: boolean;
    setEnableCaptions: (v: boolean) => void;
    enableBackgroundMusic: boolean;
    setEnableBackgroundMusic: (v: boolean) => void;
    handleCreateVideo: () => void;
    canGenerate: boolean;
    isProcessing: boolean;

    // Photo
    photoPreview: string;
    handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    useStudioImage: boolean;
    studioReadyUrl: string;
    isGeneratingStudio: boolean;
    toggleStudioImage: () => void;
    onMakeStudioReady: () => void;
    onOpenGallery: () => void;
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

    // Collected Assets
    collectedAssets: Array<{ url: string; thumbnail?: string; title?: string }>;

    // Navigation
    activeView: 'general' | 'voice' | 'avatar';
    onChangeView: (view: 'general' | 'voice' | 'avatar') => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    mode, setMode,
    duration, setDuration,
    aspectRatio, setAspectRatio,
    enableCaptions, setEnableCaptions,
    enableBackgroundMusic, setEnableBackgroundMusic,
    handleCreateVideo, canGenerate, isProcessing,

    // Photo
    photoPreview, handlePhotoUpload,
    useStudioImage, studioReadyUrl, isGeneratingStudio, toggleStudioImage,
    onMakeStudioReady, onOpenGallery, onRemovePhoto,
    savedAvatars, onSelectAvatar,

    // Voice
    allVoices, savedVoice, onVoiceSelect,
    isRecording, startRecording, stopRecording, handleVoiceUpload,
    voiceFile,

    // Collected Assets
    collectedAssets,

    // Navigation
    activeView = 'general',
    onChangeView
}) => {

    // --- Sub-View: Voice Gallery ---
    if (activeView === 'voice') {
        return (
            <div className="flex flex-col h-full bg-[var(--surface-2)] animate-in slide-in-from-right duration-200">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
                    <button onClick={() => onChangeView('general')} className="p-1 -ml-2 rounded-full hover:bg-[var(--surface-3)] text-[var(--text-secondary)]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    </button>
                    <h3 className="font-bold text-lg text-[var(--text-primary)]">Voice Library</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                    {/* Active Selection */}
                    <div className="p-4 bg-[var(--surface-1)] border border-[var(--brand-primary)] rounded-xl shadow-sm">
                        <div className="text-[10px] font-bold text-[var(--brand-primary)] uppercase tracking-wider mb-2">Selected Voice</div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center font-bold">
                                {voiceFile ? <MicIcon className="w-5 h-5" /> : (savedVoice?.name?.[0] || 'V')}
                            </div>
                            <div>
                                <div className="font-bold text-[var(--text-primary)]">{voiceFile ? voiceFile.name : savedVoice?.name || 'None Selected'}</div>
                                <div className="text-xs text-[var(--text-secondary)]">{voiceFile ? 'Custom Upload' : 'AI Preset'}</div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col items-center justify-center gap-2 p-4 border border-[var(--border-subtle)] bg-[var(--surface-1)] hover:bg-[var(--surface-3)] rounded-xl cursor-pointer transition-all group">
                            <div className="w-8 h-8 rounded-full bg-[var(--surface-3)] group-hover:bg-white flex items-center justify-center">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                            </div>
                            <span className="text-xs font-bold text-[var(--text-secondary)]">Upload Audio</span>
                            <input type="file" accept="audio/*" onChange={handleVoiceUpload} className="hidden" />
                        </label>
                        <button
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            className={`flex flex-col items-center justify-center gap-2 p-4 border border-[var(--border-subtle)] bg-[var(--surface-1)] hover:bg-[var(--surface-3)] rounded-xl cursor-pointer transition-all ${isRecording ? 'border-red-500 bg-red-50' : ''}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isRecording ? 'bg-red-500 animate-pulse text-white' : 'bg-[var(--surface-3)]'}`}>
                                <MicIcon className="w-4 h-4" />
                            </div>
                            <span className={`text-xs font-bold ${isRecording ? 'text-red-500' : 'text-[var(--text-secondary)]'}`}>{isRecording ? 'Release to Stop' : 'Hold to Record'}</span>
                        </button>
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                        <div className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">All Voices</div>
                        <div className="space-y-2">
                            {allVoices.map(voice => (
                                <div
                                    key={voice.id}
                                    onClick={() => onVoiceSelect(voice)}
                                    className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${savedVoice?.id === voice.id ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-transparent hover:bg-[var(--surface-1)]'}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${savedVoice?.id === voice.id ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-3)] text-[var(--text-secondary)]'}`}>
                                        {savedVoice?.id === voice.id ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg> : (voice.name?.[0] || 'V')}
                                    </div>
                                    <div className="flex-1">
                                        <div className={`text-sm font-bold ${savedVoice?.id === voice.id ? 'text-[var(--brand-primary)]' : 'text-[var(--text-primary)]'}`}>{voice.name}</div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); /* Preview */ }} className="p-2 rounded-full hover:bg-[var(--surface-3)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                                        <PlayIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- Sub-View: Avatar Gallery / Mode Switcher ---
    if (activeView === 'avatar' || activeView === 'general') { // Default to this view if 'general' is requested (fallback)
        return (
            <div className="flex flex-col h-full bg-[var(--surface-2)] animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
                    <h3 className="font-bold text-lg text-[var(--text-primary)]">Visuals</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">

                    {/* Unified Visual Style Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* None / Faceless Option */}
                        <button
                            onClick={() => {
                                setMode('faceless');
                                onRemovePhoto();
                            }}
                            className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all flex flex-col items-center justify-center gap-2 ${mode === 'faceless' && !photoPreview ? 'border-black bg-gray-100 shadow-[4px_4px_0px_#000]' : 'border-gray-200 hover:border-gray-400 bg-[var(--surface-1)]'}`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${mode === 'faceless' && !photoPreview ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'}`}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                                </svg>
                            </div>
                            <span className={`text-sm font-bold ${mode === 'faceless' && !photoPreview ? 'text-black' : 'text-gray-600'}`}>Faceless</span>
                            <span className="text-xs text-gray-400">No Avatar</span>
                            {mode === 'faceless' && !photoPreview && (
                                <span className="absolute top-2 right-2 text-[10px] font-bold text-black bg-[var(--brand-primary)] px-1.5 py-0.5 rounded-full">✓</span>
                            )}
                        </button>

                        {/* Upload New Photo */}
                        <label className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group ${photoPreview && mode === 'face' ? 'border-gray-200' : 'border-gray-300 hover:border-[var(--brand-primary)]'}`}>
                            <div className="w-12 h-12 rounded-full bg-gray-200 group-hover:bg-[var(--brand-primary)] flex items-center justify-center transition-colors">
                                <span className="text-2xl text-gray-500 group-hover:text-black">+</span>
                            </div>
                            <span className="text-sm font-bold text-gray-600">Upload</span>
                            <span className="text-xs text-gray-400">New Photo</span>
                            <input type="file" accept="image/*" onChange={(e) => { handlePhotoUpload(e); setMode('face'); }} className="hidden" />
                        </label>




                        {/* Current Uploaded Photo - shown if photo exists but NOT in savedAvatars */}
                        {photoPreview && !savedAvatars?.some(a => a.image_url === photoPreview) && (
                            <div
                                onClick={() => setMode('face')}
                                className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${mode === 'face' ? 'border-black shadow-[4px_4px_0px_#000]' : 'border-gray-200 hover:border-gray-400'}`}
                            >
                                <img src={useStudioImage && studioReadyUrl ? studioReadyUrl : photoPreview} className="w-full h-full object-cover" />

                                {/* Remove button */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemovePhoto(); setMode('faceless'); }}
                                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>

                                {/* Selected indicator */}
                                {mode === 'face' && (
                                    <span className="absolute top-2 left-2 text-[10px] font-bold text-black bg-[var(--brand-primary)] px-1.5 py-0.5 rounded-full">✓ New</span>
                                )}

                                {/* Studio Ready Badge or Label */}
                                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                                    <span className="text-white text-xs font-bold">{useStudioImage ? '✨ Studio Ready' : 'Your Photo'}</span>
                                    {studioReadyUrl && (
                                        <button onClick={(e) => { e.stopPropagation(); toggleStudioImage(); }} className={`text-[10px] font-bold px-2 py-1 rounded-md ${useStudioImage ? 'bg-[var(--brand-primary)] text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                                            {useStudioImage ? 'Enhanced' : 'Original'}
                                        </button>
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
                                className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all group ${photoPreview === avatar.image_url && mode === 'face' ? 'border-black shadow-[4px_4px_0px_#000]' : 'border-gray-200 hover:border-gray-400'}`}
                            >
                                <img src={avatar.image_url} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">Select</span>
                                </div>
                                {photoPreview === avatar.image_url && mode === 'face' && (
                                    <span className="absolute top-2 left-2 text-[10px] font-bold text-black bg-[var(--brand-primary)] px-1.5 py-0.5 rounded-full">✓</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Studio Ready Enhancement Prompt */}
                    {photoPreview && !useStudioImage && mode === 'face' && (
                        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
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

                    {/* Faceless Mode Info */}
                    {mode === 'faceless' && (
                        <div className="p-4 bg-[var(--surface-1)] rounded-xl border border-[var(--border-subtle)]">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)]/20 flex items-center justify-center flex-shrink-0">
                                    <ImageIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-[var(--text-primary)] text-sm mb-1">Faceless Mode</h4>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Stock images and videos will be automatically selected based on your script. Review them in <strong>Assets</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null; // Fallback for unknown views
};
