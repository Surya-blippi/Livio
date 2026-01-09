import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ClockIcon } from './icons';
import { PhotoSelector } from './selectors/PhotoSelector';
import { VoiceSelector } from './selectors/VoiceSelector';
import { DbVoice } from '@/lib/supabase';

interface ControlBarProps {
    mode: 'face' | 'faceless';
    duration: number;
    setDuration: (val: number) => void;
    enableCaptions: boolean;
    setEnableCaptions: (val: boolean) => void;
    enableBackgroundMusic: boolean;
    setEnableBackgroundMusic: (val: boolean) => void;
    handleCreateVideo: () => void;
    canGenerate: boolean;

    // Selector Props
    photoPreview: string;
    handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    useStudioImage: boolean;
    studioReadyUrl: string;
    isGeneratingStudio: boolean;
    toggleStudioImage: () => void;
    onMakeStudioReady: () => void;
    onOpenGallery: () => void;
    onRemovePhoto: () => void;

    allVoices: DbVoice[];
    savedVoice: DbVoice | null;
    isRecording: boolean;
    startRecording: () => void;
    handleVoiceUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onVoiceSelect: (voice: DbVoice) => void;
    hasClonedVoice: boolean;
    voiceFile: File | null;
}

const DURATIONS = [
    { value: 15, label: '15s' },
    { value: 30, label: '30s' },
    { value: 45, label: '45s' },
    { value: 60, label: '60s' },
];

export const ControlBar: React.FC<ControlBarProps> = ({
    mode,
    duration,
    setDuration,
    enableCaptions,
    setEnableCaptions,
    enableBackgroundMusic,
    setEnableBackgroundMusic,
    handleCreateVideo,
    canGenerate,

    // Spread selector props
    photoPreview,
    handlePhotoUpload,
    useStudioImage,
    studioReadyUrl,
    isGeneratingStudio,
    toggleStudioImage,
    onMakeStudioReady,
    onOpenGallery,
    onRemovePhoto,

    allVoices,
    savedVoice,
    isRecording,
    startRecording,
    handleVoiceUpload,
    onVoiceSelect,
    hasClonedVoice,
    voiceFile
}) => {
    const [showDurationPicker, setShowDurationPicker] = useState(false);

    return (
        <div className="px-6 pb-6 pt-2 flex flex-col md:flex-row items-center justify-between gap-6">

            {/* Left: Assets (Only in Face Mode) */}
            <div className="flex items-center gap-3 w-full md:w-auto">
                {mode === 'face' && (
                    <>
                        <PhotoSelector
                            photoPreview={photoPreview}
                            handlePhotoUpload={handlePhotoUpload}
                            useStudioImage={useStudioImage}
                            studioReadyUrl={studioReadyUrl}
                            isGeneratingStudio={isGeneratingStudio}
                            toggleStudioImage={toggleStudioImage}
                            onMakeStudioReady={onMakeStudioReady}
                            onOpenGallery={onOpenGallery}
                            onRemove={onRemovePhoto}
                        />

                        <VoiceSelector
                            allVoices={allVoices}
                            savedVoice={savedVoice}
                            isRecording={isRecording}
                            startRecording={startRecording}
                            handleVoiceUpload={handleVoiceUpload}
                            onVoiceSelect={onVoiceSelect}
                            hasClonedVoice={hasClonedVoice}
                            voiceFile={voiceFile}
                        />
                    </>
                )}
            </div>

            {/* Right: Settings & Action */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">

                {/* Duration Picker */}
                <div className="relative">
                    <button
                        onClick={() => setShowDurationPicker(!showDurationPicker)}
                        className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] transition-all bg-[var(--surface-3)] text-[var(--text-secondary)] hover:bg-[var(--surface-1)] font-semibold text-sm"
                    >
                        <ClockIcon /> {duration}s
                    </button>
                    {showDurationPicker && (
                        <div className="absolute bottom-full right-0 mb-2 p-1.5 rounded-[var(--radius-md)] shadow-xl border border-[var(--border-subtle)] flex gap-1 z-50 bg-[var(--surface-2)]">
                            {DURATIONS.map((d) => (
                                <button key={d.value} onClick={() => { setDuration(d.value); setShowDurationPicker(false); }} className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-bold transition-all ${duration === d.value ? 'bg-[var(--text-primary)] text-[var(--surface-1)]' : 'hover:bg-[var(--surface-3)] text-[var(--text-primary)]'}`}>
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Toggles */}
                <button
                    onClick={() => setEnableCaptions(!enableCaptions)}
                    className={`p-2.5 rounded-[var(--radius-md)] transition-all ${enableCaptions ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-[var(--surface-3)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                    title="Captions"
                >
                    <span className="text-lg">📝</span>
                </button>
                <button
                    onClick={() => setEnableBackgroundMusic(!enableBackgroundMusic)}
                    className={`p-2.5 rounded-[var(--radius-md)] transition-all ${enableBackgroundMusic ? 'bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400' : 'bg-[var(--surface-3)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                    title="Background Music"
                >
                    <span className="text-lg">🎵</span>
                </button>

                {/* CREATE BUTTON */}
                <motion.button
                    onClick={handleCreateVideo}
                    disabled={!canGenerate}
                    whileHover={canGenerate ? { scale: 1.05 } : {}}
                    whileTap={canGenerate ? { scale: 0.95 } : {}}
                    className={`flex items-center gap-2 px-6 py-3 rounded-[var(--radius-md)] font-bold text-sm shadow-lg shadow-orange-500/20 transition-all ${canGenerate ? 'bg-[var(--brand-gradient)] text-white' : 'bg-[var(--surface-3)] text-[var(--text-tertiary)] cursor-not-allowed'}`}
                >
                    <span>Create Video</span>
                    <span className="text-lg">✨</span>
                </motion.button>
            </div>
        </div>
    );
};
