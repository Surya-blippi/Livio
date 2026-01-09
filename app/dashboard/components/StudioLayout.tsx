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

                {/* Main Content Area - Premium */}
                <div className="flex-1 overflow-y-auto pt-[220px] pb-8 bg-[#FAFAFA]">
                    <div className="px-5 pt-4">
                        {/* Section Header */}
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-300 mb-4">Inspiration</p>

                        {/* Topic Pills - Ghost Style */}
                        <div className="flex flex-wrap gap-2 mb-8">
                            {['AI & Tech', 'Crypto', 'Fitness', 'Life Hacks', 'Movies', 'Travel'].map((topic, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInputText(topic)}
                                    className="px-4 py-2.5 bg-white/60 hover:bg-white border border-gray-200/60 hover:border-gray-300 rounded-full text-sm text-gray-600 hover:text-gray-900 shadow-sm hover:shadow transition-all duration-200"
                                >
                                    {topic}
                                </button>
                            ))}
                        </div>

                        {/* Quick Ideas - Text Links */}
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-300 mb-3">Quick Ideas</p>
                        <div className="space-y-2">
                            {[
                                { text: 'Morning productivity routine', icon: '☀️' },
                                { text: '5 money saving tips', icon: '💰' },
                                { text: 'Interesting facts about space', icon: '🚀' },
                                { text: 'Simple DIY home projects', icon: '🔨' },
                            ].map((idea, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInputText(idea.text)}
                                    className="flex items-center gap-3 w-full px-4 py-3 bg-white/40 hover:bg-white rounded-2xl text-left text-sm text-gray-600 hover:text-gray-900 border border-transparent hover:border-gray-200/60 transition-all duration-200 group"
                                >
                                    <span className="text-lg opacity-60 group-hover:opacity-100 transition-opacity">{idea.icon}</span>
                                    <span>{idea.text}</span>
                                </button>
                            ))}
                        </div>
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
