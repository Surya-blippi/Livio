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
    onRegenerateScenes: () => void;
    isRegeneratingScenes?: boolean;

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
    processingStep?: number;
    sceneProgress?: {
        totalScenes: number;
        processedScenesCount: number;
        currentSceneIndex: number;
        isRendering: boolean;
    } | null;
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
    onRegenerateScenes,
    isRegeneratingScenes,
    videoUrl,
    videoHistory,
    onSelectVideo,
    onDeleteVideo,
    inputText,
    setInputText,
    onGenerate,
    isProcessing,
    processingMessage,
    processingStep,
    sceneProgress,
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

            <div className="lg:hidden flex flex-col w-full h-screen overflow-hidden bg-[var(--surface-1)]">
                {/* Top Nav Bar with Hamburger */}
                <MobileNavBar onOpenHistory={() => setActiveSheet('history')} />

                {/* Content below nav bar */}
                <div className="flex-1 flex flex-col pt-14">

                    {/* Mobile Composer */}
                    <MobileComposer
                        inputText={inputText}
                        setInputText={setInputText}
                        onGenerate={onGenerate}
                        isProcessing={isProcessing}
                        processingMessage={processingMessage}
                        processingStep={processingStep}
                        sceneProgress={sceneProgress}
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
                    {/* Workflow Tiles - With Action Buttons */}
                    <div className="flex-1 flex flex-col gap-2 px-4 pt-4 pb-4 bg-[var(--surface-1)]">
                        {/* Script Tile - Always clickable for editing */}
                        <button
                            onClick={() => setActiveSheet('script')}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${hasScript
                                ? 'bg-gradient-to-r from-purple-500 to-purple-600 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-white border-purple-200 hover:border-purple-400'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${hasScript ? 'bg-white/20' : 'bg-purple-50'}`}>
                                ✨
                            </div>
                            <div className="flex-1">
                                <p className={`font-black text-sm ${hasScript ? 'text-white' : 'text-gray-600'}`}>Script</p>
                                <p className={`text-xs ${hasScript ? 'text-white/80' : 'text-gray-400'}`}>
                                    {hasScript ? 'Tap to edit' : 'Write or generate'}
                                </p>
                            </div>
                            {/* Edit/Pencil Icon */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasScript ? 'bg-white/20' : 'bg-purple-100'}`}>
                                <svg className={`w-4 h-4 ${hasScript ? 'text-white' : 'text-purple-600'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                            </div>
                        </button>

                        {/* Assets Tile */}
                        <button
                            onClick={() => setActiveSheet('assets')}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${hasAssets
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-white border-blue-200 hover:border-blue-400'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${hasAssets ? 'bg-white/20' : 'bg-blue-50'}`}>
                                🖼️
                            </div>
                            <div className="flex-1">
                                <p className={`font-black text-sm ${hasAssets ? 'text-white' : 'text-gray-600'}`}>Assets</p>
                                <p className={`text-xs ${hasAssets ? 'text-white/80' : 'text-gray-400'}`}>
                                    {hasAssets ? `${assets.length} images` : 'Upload images'}
                                </p>
                            </div>
                            {/* Upload Icon */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasAssets ? 'bg-white/20' : 'bg-blue-100'}`}>
                                <svg className={`w-4 h-4 ${hasAssets ? 'text-white' : 'text-blue-600'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                            </div>
                        </button>

                        {/* Storyboard Tile */}
                        <button
                            onClick={() => hasStoryboard && setActiveSheet('storyboard')}
                            disabled={!hasStoryboard}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${hasStoryboard
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-white border-gray-100 opacity-50'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${hasStoryboard ? 'bg-white/20' : 'bg-gray-100'}`}>
                                🎬
                            </div>
                            <div className="flex-1">
                                <p className={`font-black text-sm ${hasStoryboard ? 'text-white' : 'text-gray-400'}`}>Scenes</p>
                                <p className={`text-xs ${hasStoryboard ? 'text-white/80' : 'text-gray-300'}`}>Video storyboard</p>
                            </div>
                            {hasStoryboard && (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            )}
                        </button>

                        {/* Video Tile */}
                        <button
                            onClick={() => hasVideo && setActiveSheet('video')}
                            disabled={!hasVideo}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${hasVideo
                                ? 'bg-gradient-to-r from-[var(--brand-primary)] to-lime-400 border-black shadow-[3px_3px_0px_#000]'
                                : 'bg-white border-gray-100 opacity-50'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${hasVideo ? 'bg-white/20' : 'bg-gray-100'}`}>
                                🎥
                            </div>
                            <div className="flex-1">
                                <p className={`font-black text-sm ${hasVideo ? 'text-black' : 'text-gray-400'}`}>Video</p>
                                <p className={`text-xs ${hasVideo ? 'text-black/70' : 'text-gray-300'}`}>Final output</p>
                            </div>
                            {hasVideo && (
                                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

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
                    setInputText={setInputText}
                    onEnhance={onEnhance}
                    isEnhancing={isEnhancing}
                    assets={assets}
                    onUploadAsset={onUploadAsset}
                    onRemoveAsset={onRemoveAsset}
                    scenes={scenes}
                    onRegenerateScenes={onRegenerateScenes}
                    isRegeneratingScenes={isRegeneratingScenes}
                    videoUrl={videoUrl}
                    videoHistory={videoHistory}
                    onSelectVideo={onSelectVideo}
                    onDeleteVideo={onDeleteVideo}
                />
            </div>

        </div>
    );
};
