import React, { useRef, useState } from 'react';
import { ImageIcon } from '../icons';
import { DbAvatar } from '@/lib/supabase';

interface PhotoSelectorProps {
    photoPreview: string;
    handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    useStudioImage: boolean;
    studioReadyUrl: string;
    isGeneratingStudio: boolean;
    toggleStudioImage: () => void;
    onMakeStudioReady: () => void;
    onOpenGallery: () => void;
    onRemove: () => void;
}

export const PhotoSelector: React.FC<PhotoSelectorProps> = ({
    photoPreview,
    handlePhotoUpload,
    useStudioImage,
    studioReadyUrl,
    isGeneratingStudio,
    toggleStudioImage,
    onMakeStudioReady,
    onOpenGallery,
    onRemove
}) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const displayImage = (useStudioImage && studioReadyUrl) ? studioReadyUrl : photoPreview;
    const label = (useStudioImage && studioReadyUrl) ? 'Studio' : 'Photo';

    return (
        <div className="relative">
            <button
                onClick={() => photoPreview ? setShowDropdown(!showDropdown) : fileInputRef.current?.click()}
                className={`flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full transition-all duration-200 group/chip ${photoPreview
                    ? 'bg-[var(--surface-3)] hover:bg-[var(--surface-1)] ring-1 ring-[var(--border-subtle)]'
                    : 'bg-[var(--surface-1)] border border-dashed border-[var(--text-tertiary)] hover:border-[var(--text-secondary)]'}`}
            >
                {photoPreview ? (
                    <>
                        <img src={displayImage} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm bg-[var(--surface-2)]" />
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {label}
                        </span>
                    </>
                ) : (
                    <>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--surface-2)] text-[var(--text-secondary)]">
                            <ImageIcon />
                        </div>
                        <span className="text-sm font-medium text-[var(--text-secondary)]">Add Photo</span>
                    </>
                )}
            </button>

            {showDropdown && photoPreview && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-64 rounded-[var(--radius-lg)] shadow-2xl border border-[var(--border-subtle)] p-2 z-50 bg-[var(--surface-2)] backdrop-blur-xl animate-scaleIn">
                        <button onClick={() => { setShowDropdown(false); onOpenGallery(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-all hover:bg-[var(--surface-3)]">
                            <span className="text-lg">👁️</span> <span className="text-sm font-medium text-[var(--text-primary)]">Gallery & Preview</span>
                        </button>

                        {studioReadyUrl && (
                            <button onClick={() => { toggleStudioImage(); setShowDropdown(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-all hover:bg-[var(--surface-3)]">
                                <span className="text-lg">{useStudioImage ? '📷' : '✨'}</span>
                                <span className="text-sm font-medium text-[var(--text-primary)]">Use {useStudioImage ? 'Original' : 'Studio Ready'}</span>
                            </button>
                        )}

                        {!studioReadyUrl && (
                            <button onClick={() => { setShowDropdown(false); onMakeStudioReady(); }} disabled={isGeneratingStudio} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-all hover:bg-[var(--surface-3)] opacity-${isGeneratingStudio ? '50' : '100'}`}>
                                <span className="text-lg">✨</span> <span className="text-sm font-medium text-[var(--text-primary)]">Make Studio Ready</span>
                            </button>
                        )}

                        <div className="my-1 h-px bg-[var(--border-subtle)]" />

                        <button onClick={() => { setShowDropdown(false); fileInputRef.current?.click(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-all hover:bg-[var(--surface-3)]">
                            <span className="text-lg">📤</span> <span className="text-sm font-medium text-[var(--text-primary)]">Upload New</span>
                        </button>

                        <button onClick={() => { setShowDropdown(false); onRemove(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-all hover:bg-red-500/10 text-red-500">
                            <span className="text-lg">🗑️</span> <span className="text-sm font-medium">Remove</span>
                        </button>
                    </div>
                </>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
        </div>
    );
};
