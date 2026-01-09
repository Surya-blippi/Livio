import React, { useRef, useState } from 'react';
import { MicIcon, PlayIcon, PauseIcon } from '../icons';
import { DbVoice } from '@/lib/supabase';

interface VoiceSelectorProps {
    allVoices: DbVoice[];
    savedVoice: DbVoice | null;
    isRecording: boolean;
    startRecording: () => void;
    handleVoiceUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onVoiceSelect: (voice: DbVoice) => void;
    hasClonedVoice: boolean;
    voiceFile: File | null;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
    allVoices,
    savedVoice,
    isRecording,
    startRecording,
    handleVoiceUpload,
    onVoiceSelect,
    hasClonedVoice,
    voiceFile
}) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePlayVoice = (e: React.MouseEvent, voiceUrl: string, voiceId: string) => {
        e.stopPropagation();

        if (playingVoiceId === voiceId) {
            audioRef.current?.pause();
            setPlayingVoiceId(null);
        } else {
            if (audioRef.current) audioRef.current.pause();
            const audio = new Audio(voiceUrl);
            audio.onended = () => setPlayingVoiceId(null);
            audio.play().catch(err => console.error("Playback failed", err));
            audioRef.current = audio;
            setPlayingVoiceId(voiceId);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={`flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full transition-all duration-200 ${hasClonedVoice || voiceFile
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20'
                    : 'bg-[var(--surface-1)] border border-dashed border-[var(--text-tertiary)] hover:border-[var(--text-secondary)]'}`}
            >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasClonedVoice || voiceFile ? 'bg-emerald-500 text-white shadow-sm' : 'bg-[var(--surface-2)] text-[var(--text-secondary)]'}`}>
                    <MicIcon />
                </div>
                <span className={`text-sm font-semibold ${hasClonedVoice || voiceFile ? '' : 'text-[var(--text-secondary)]'}`}>
                    {hasClonedVoice || voiceFile ? (savedVoice?.name || 'Voice Added') : 'Add Voice'}
                </span>
            </button>

            {showDropdown && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-[var(--radius-lg)] shadow-2xl border border-[var(--border-subtle)] p-2 z-50 max-h-96 overflow-y-auto bg-[var(--surface-2)] backdrop-blur-xl animate-scaleIn">
                        {allVoices.length > 0 && (
                            <>
                                <p className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Your Voices</p>
                                {allVoices.map((voice) => (
                                    <div key={voice.id}
                                        onClick={() => { onVoiceSelect(voice); setShowDropdown(false); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-all cursor-pointer group ${voice.is_active ? 'bg-emerald-500/10 dark:bg-emerald-500/20' : 'hover:bg-[var(--surface-3)]'}`}
                                    >
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500 text-white text-xs shrink-0"><MicIcon /></div>
                                        <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate text-[var(--text-primary)]">{voice.name || 'My Voice'}</p></div>

                                        {voice.preview_url && (
                                            <button
                                                onClick={(e) => handlePlayVoice(e, voice.preview_url!, voice.id)}
                                                className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${playingVoiceId === voice.id ? 'text-emerald-500' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'}`}
                                            >
                                                {playingVoiceId === voice.id ? <PauseIcon /> : <PlayIcon />}
                                            </button>
                                        )}

                                        {voice.is_active && <span className="text-emerald-500">✓</span>}
                                    </div>
                                ))}
                                <div className="my-2 h-px bg-[var(--border-subtle)]" />
                            </>
                        )}

                        <button onClick={() => { setShowDropdown(false); if (!isRecording) startRecording(); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-all hover:bg-[var(--surface-3)] ${isRecording ? 'text-red-500 bg-red-500/10' : ''}`}>
                            <span className="text-lg">🎙️</span> <span className="text-sm font-medium text-[var(--text-primary)]">{isRecording ? 'Recording...' : 'Record New Voice'}</span>
                        </button>

                        <button onClick={() => { setShowDropdown(false); fileInputRef.current?.click(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-all hover:bg-[var(--surface-3)]">
                            <span className="text-lg">📤</span> <span className="text-sm font-medium text-[var(--text-primary)]">Upload Audio File</span>
                        </button>
                    </div>
                </>
            )}
            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleVoiceUpload} className="hidden" />
        </div>
    );
};
