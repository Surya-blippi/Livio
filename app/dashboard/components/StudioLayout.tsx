import React, { useState } from 'react';
import { MobileNavBar } from './MobileNavigation';
import { MobileOverlays, MobileSheetType } from './MobileOverlays';
import { MobileComposer } from './MobileComposer';

interface StudioLayoutProps {
    // Desktop panels
    resourcePanel: React.ReactNode;
    editorPanel: React.ReactNode;
    propertiesPanel: React.ReactNode;

    // Mobile data
    mode: 'face' | 'faceless';
    setMode: (m: 'face' | 'faceless') => void;
    avatarUrl?: string;
    savedAvatars: any[];
    onSelectAvatar: (avatar: any) => void;
    onUploadAvatar: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onDeleteAvatar: (avatarId: string) => void;

    // Studio Ready
    useStudioImage: boolean;
    studioReadyUrl?: string;
    isGeneratingStudio: boolean;
    onMakeStudioReady: () => void;
    toggleStudioImage: () => void;

    voices: any[];
    selectedVoice?: any;
    onSelectVoice: (voice: any) => void;
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

    duration: number;
    setDuration: (d: number) => void;
    aspectRatio: string;
    setAspectRatio: (r: string) => void;

    script: string;
    assets: any[];
    onUploadAsset: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveAsset: (index: number) => void;
    scenes: any[];

    videoUrl?: string;
    videoHistory: any[];
    onSelectVideo: (video: any) => void;
    onDeleteVideo: (id: string) => void;

    // Composer props
    inputText: string;
    setInputText: (text: string) => void;
    onGenerate: () => void;
    isProcessing: boolean;
    processingMessage: string;
    enableCaptions: boolean;
    setEnableCaptions: (enabled: boolean) => void;
    enableBackgroundMusic: boolean;
    setEnableBackgroundMusic: (enabled: boolean) => void;
    onEnhance: () => void;
    onCollectAssets: () => void;
    isEnhancing: boolean;
    isCollectingAssets: boolean;
    voiceName: string;
    hasScript: boolean;
    hasAssets: boolean;
    hasStoryboard: boolean;
    hasVideo: boolean;
}

export const StudioLayout: React.FC<StudioLayoutProps> = ({
    resourcePanel,
    editorPanel,
    propertiesPanel,
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
    assets,
    onUploadAsset,
    onRemoveAsset,
    scenes,
    videoUrl,
    videoHistory,
    onSelectVideo,
    onDeleteVideo,
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
    voiceName,
    hasScript,
    hasAssets,
    hasStoryboard,
    hasVideo
}) => {
    const [activeSheet, setActiveSheet] = useState<MobileSheetType>(null);

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[var(--surface-1)] text-[var(--text-primary)] font-sans">

            {/* =========================================
               DESKTOP LAYOUT (Strict 3-Pane)
               Visible only on lg+ screens
               ========================================= */}

            {/* Left Panel */}
            <aside className="hidden lg:flex w-[280px] flex-shrink-0 border-r-2 border-[var(--border-strong)] bg-[var(--surface-1)]/80 backdrop-blur-sm flex-col z-20">
                {resourcePanel}
            </aside>

            {/* Center Panel */}
            <main className="hidden lg:flex flex-1 min-w-0 flex-col relative z-10 bg-transparent">
                {editorPanel}
            </main>

            {/* Right Panel */}
            <aside className="hidden lg:flex w-[450px] flex-shrink-0 border-l-2 border-[var(--border-strong)] bg-[var(--surface-1)]/80 backdrop-blur-sm flex-col z-20">
                {propertiesPanel}
            </aside>


            {/* =========================================
               MOBILE LAYOUT (Single Screen + Overlays)
               Visible only on < lg screens
               ========================================= */}

            <div className="lg:hidden flex-1 flex flex-col relative w-full h-full bg-[var(--surface-1)]">
                {/* Top Nav Bar with Hamburger */}
                <MobileNavBar onOpenHistory={() => setActiveSheet('history')} />

                {/* Main Content Area - Vertical Workflow Tiles */}
                <div className="flex-1 overflow-y-auto pt-[220px] pb-6 px-4 bg-[var(--surface-1)]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">Workflow</p>
                    <div className="space-y-3">
                        {[
                            { id: 'script', label: 'Script', desc: 'AI-generated script', icon: '✨', active: hasScript, color: 'from-purple-500 to-purple-600' },
                            { id: 'assets', label: 'Assets', desc: 'Images and media', icon: '🖼️', active: hasAssets, color: 'from-blue-500 to-blue-600' },
                            { id: 'storyboard', label: 'Scenes', desc: 'Video storyboard', icon: '🎬', active: hasStoryboard, color: 'from-orange-500 to-orange-600' },
                            { id: 'video', label: 'Video', desc: 'Final output', icon: '🎥', active: hasVideo, color: 'from-[var(--brand-primary)] to-lime-400' },
                        ].map((step) => (
                            <button
                                key={step.id}
                                onClick={() => step.active && setActiveSheet(step.id as MobileSheetType)}
                                disabled={!step.active}
                                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${step.active
                                    ? `bg-gradient-to-r ${step.color} border-black shadow-[4px_4px_0px_#000] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#000]`
                                    : 'bg-white border-gray-100 opacity-50'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${step.active ? 'bg-white/20' : 'bg-gray-100'}`}>
                                    {step.icon}
                                </div>
                                <div className="flex-1">
                                    <p className={`font-black text-sm ${step.active ? 'text-white' : 'text-gray-400'}`}>{step.label}</p>
                                    <p className={`text-xs ${step.active ? 'text-white/80' : 'text-gray-300'}`}>{step.desc}</p>
                                </div>
                                {step.active && (
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mobile Composer (Fixed at top) */}
                <MobileComposer
                    inputText={inputText}
                    setInputText={setInputText}
                    onGenerate={onGenerate}
                    isProcessing={isProcessing}
                    processingMessage={processingMessage}
                    enableCaptions={enableCaptions}
                    setEnableCaptions={setEnableCaptions}
                    enableBackgroundMusic={enableBackgroundMusic}
                    setEnableBackgroundMusic={setEnableBackgroundMusic}
                    onEnhance={onEnhance}
                    onCollectAssets={onCollectAssets}
                    isEnhancing={isEnhancing}
                    isCollectingAssets={isCollectingAssets}
                    onOpenSheet={setActiveSheet}
                    voiceName={voiceName}
                    avatarUrl={avatarUrl}
                    mode={mode}
                    duration={duration}
                    aspectRatio={aspectRatio}
                    hasScript={hasScript}
                    hasAssets={hasAssets}
                    hasStoryboard={hasStoryboard}
                    hasVideo={hasVideo}
                />

                {/* Mobile Overlays */}
                <MobileOverlays
                    activeSheet={activeSheet}
                    onClose={() => setActiveSheet(null)}
                    mode={mode}
                    setMode={setMode}
                    avatarUrl={avatarUrl}
                    savedAvatars={savedAvatars}
                    onSelectAvatar={onSelectAvatar}
                    onUploadAvatar={onUploadAvatar}
                    onDeleteAvatar={onDeleteAvatar}
                    useStudioImage={useStudioImage}
                    studioReadyUrl={studioReadyUrl}
                    isGeneratingStudio={isGeneratingStudio}
                    onMakeStudioReady={onMakeStudioReady}
                    toggleStudioImage={toggleStudioImage}
                    voices={voices}
                    selectedVoice={selectedVoice}
                    onSelectVoice={onSelectVoice}
                    isRecording={isRecording}
                    onStartRecording={onStartRecording}
                    onStopRecording={onStopRecording}
                    onUploadVoice={onUploadVoice}
                    onDeleteVoice={onDeleteVoice}
                    voiceFile={voiceFile}
                    onConfirmVoice={onConfirmVoice}
                    onClearVoice={onClearVoice}
                    isConfirmingVoice={isConfirmingVoice}
                    hasClonedVoice={hasClonedVoice}
                    duration={duration}
                    setDuration={setDuration}
                    aspectRatio={aspectRatio}
                    setAspectRatio={setAspectRatio}
                    script={script}
                    assets={assets}
                    onUploadAsset={onUploadAsset}
                    onRemoveAsset={onRemoveAsset}
                    scenes={scenes}
                    videoUrl={videoUrl}
                    videoHistory={videoHistory}
                    onSelectVideo={onSelectVideo}
                    onDeleteVideo={onDeleteVideo}
                />
            </div>

        </div>
    );
};
