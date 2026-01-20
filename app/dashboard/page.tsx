'use client';

import React, { useEffect, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDashboardState } from './hooks/useDashboardState';
import { StudioLayout } from './components/StudioLayout';
import { PaymentVerification } from './components/PaymentVerification';
import { ResourcePanel } from './components/studio/ResourcePanel';
import { EditorPanel } from './components/studio/EditorPanel';
import { PreviewPanel } from './components/studio/PreviewPanel';
import { CloseIcon, ImageIcon } from './components/icons';
import { useCredits } from './context/CreditsContext';
import { CREDIT_COSTS } from '@/lib/credits';

// ==========================================
// MAIN COMPONENT (STUDIO WORKSPACE)
// ==========================================

export default function Dashboard() {
    const state = useDashboardState();
    const { checkCreditsWithContext, openBuyModalWithContext, balance } = useCredits();
    const [isEnhancing, setIsEnhancing] = React.useState(false);
    const [isCollectingAssets, setIsCollectingAssets] = React.useState(false);
    const [isUploadingAsset, setIsUploadingAsset] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState({ current: 0, total: 0 });

    // Dark Mode Effect
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', state.isDark ? 'dark' : 'light');
    }, [state.isDark]);

    // Derived Handler for Photo remove
    const onRemovePhoto = () => {
        state.setPhotoFile(null);
        state.setPhotoPreview('');
        state.setStudioReadyUrl('');
        state.setUseStudioImage(false);
    };

    // Enhance handler with credit pre-check
    const handleEnhance = async () => {
        if (!state.inputText.trim()) return;

        // Pre-check credits for script generation
        if (!checkCreditsWithContext(CREDIT_COSTS.RESEARCH_SCRIPT, 'Script Generation')) {
            return; // Modal will open automatically
        }

        setIsEnhancing(true);
        try {
            const res = await fetch('/api/enhance-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: state.inputText, duration: state.duration }),
            });
            const data = await res.json();
            if (!res.ok) {
                // Check if this is a credits error - open modal instead of alert
                if (res.status === 402 || data.code === 'INSUFFICIENT_CREDITS') {
                    openBuyModalWithContext(CREDIT_COSTS.RESEARCH_SCRIPT, 'Script Generation');
                    return;
                }
                console.error('Enhance failed:', data.error);
                return;
            }
            if (data.script) {
                state.setInputText(data.script);
                state.setPreviewMode('script');
            }
            if (data.scenes && Array.isArray(data.scenes)) {
                state.setScenes(data.scenes);
            }
        } catch (err) {
            console.error('Enhance failed:', err);
        } finally {
            setIsEnhancing(false);
        }
    };

    // Collect assets handler
    const handleCollectAssets = async () => {
        if (!state.inputText.trim()) return;
        setIsCollectingAssets(true);
        try {
            await state.handleCollectAssets();
            state.setPreviewMode('assets');
        } catch (error) {
            console.error(error);
        } finally {
            setIsCollectingAssets(false);
        }
    };

    // Upload asset handler - uploads to Supabase immediately
    const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        setIsUploadingAsset(true);
        setUploadProgress({ current: 0, total: fileArray.length });

        try {
            // Upload each file immediately to Supabase
            for (let i = 0; i < fileArray.length; i++) {
                setUploadProgress({ current: i + 1, total: fileArray.length });
                await state.addUserAsset(fileArray[i]);
            }
        } finally {
            setIsUploadingAsset(false);
            setUploadProgress({ current: 0, total: 0 });
        }
        e.target.value = '';
    };

    // Avatar select handler
    const handleSelectAvatar = (avatar: any) => {
        state.setPhotoPreview(avatar.image_url);
        state.setPhotoFile(null);
        if (avatar.is_default) {
            state.setUseStudioImage(true);
            state.setStudioReadyUrl(avatar.image_url);
        } else {
            state.setUseStudioImage(false);
            state.setStudioReadyUrl('');
        }
    };

    return (
        <>
            <Suspense fallback={null}>
                <PaymentVerification />
            </Suspense>
            <StudioLayout
                // Desktop panels
                resourcePanel={
                    <ResourcePanel
                        videoHistory={state.videoHistory}
                        onSelectVideo={state.handleSelectVideo}
                        onDeleteVideo={state.handleDeleteVideo}
                        onNewProject={state.handleReset}
                    />
                }
                editorPanel={
                    <EditorPanel
                        mode={state.mode}
                        setMode={state.setMode}
                        editType={state.editType}
                        setEditType={state.setEditType}
                        inputText={state.inputText}
                        setInputText={state.setInputText}
                        handleCreateVideo={state.handleCreateVideo}
                        isProcessing={state.isProcessing}
                        processingMessage={state.processingMessage}
                        processingStep={state.processingStep}
                        sceneProgress={state.sceneProgress}
                        voiceName={state.savedVoice?.name ?? 'Select Voice'}
                        avatarUrl={state.useStudioImage ? state.studioReadyUrl : state.photoPreview}
                        aspectRatio={state.aspectRatio}
                        setAspectRatio={(r) => state.setAspectRatio(r as any)}
                        enableCaptions={state.enableCaptions}
                        setEnableCaptions={state.setEnableCaptions}
                        captionStyle={state.captionStyle}
                        setCaptionStyle={state.setCaptionStyle}
                        enableBackgroundMusic={state.enableBackgroundMusic}
                        setEnableBackgroundMusic={state.setEnableBackgroundMusic}
                        duration={state.duration}
                        setDuration={state.setDuration}
                        setPreviewMode={state.setPreviewMode}
                        onEnhance={handleEnhance}
                        onCollectAssets={handleCollectAssets}
                        hasScript={!!state.inputText && state.inputText.length > 10}
                        hasAssets={state.collectedAssets.length > 0}
                        hasStoryboard={state.scenes.length > 0}
                        hasVideo={!!state.videoUrl || !!state.selectedVideo}
                        hasVoice={state.hasClonedVoice || !!state.voiceFile}
                        hasAvatar={!!(state.photoPreview || (state.useStudioImage && state.studioReadyUrl))}
                        isEnhancing={isEnhancing}
                        isCollectingAssets={isCollectingAssets}
                    />
                }
                propertiesPanel={
                    <PreviewPanel
                        previewMode={state.previewMode}
                        setPreviewMode={state.setPreviewMode}
                        videoUrl={state.videoUrl}
                        aspectRatio={state.aspectRatio}
                        mode={state.mode}
                        setMode={state.setMode}
                        photoPreview={state.photoPreview}
                        handlePhotoUpload={state.handlePhotoUpload}
                        useStudioImage={state.useStudioImage}
                        studioReadyUrl={state.studioReadyUrl}
                        isGeneratingStudio={state.isGeneratingStudio}
                        toggleStudioImage={() => state.setUseStudioImage(!state.useStudioImage)}
                        onMakeStudioReady={state.handleMakeStudioReady}
                        onRemovePhoto={onRemovePhoto}
                        savedAvatars={state.savedAvatars}
                        onSelectAvatar={handleSelectAvatar}
                        allVoices={state.allVoices}
                        savedVoice={state.savedVoice}
                        isRecording={state.isRecording}
                        startRecording={state.startRecording}
                        stopRecording={state.stopRecording}
                        handleVoiceUpload={state.handleVoiceUpload}
                        onVoiceSelect={state.onVoiceSelect}
                        hasClonedVoice={state.hasClonedVoice}
                        voiceFile={state.voiceFile}
                        onClearVoice={() => state.setVoiceFile(null)}
                        onConfirmVoice={state.handleConfirmVoice}
                        isConfirmingVoice={state.isConfirmingVoice}
                        collectedAssets={state.collectedAssets}
                        onUploadAsset={handleUploadAsset}
                        isUploadingAsset={isUploadingAsset}
                        uploadProgress={uploadProgress}
                        onRemoveAsset={(index) => state.setCollectedAssets(prev => prev.filter((_, i) => i !== index))}
                        script={state.inputText}
                        setInputText={state.setInputText}
                        onEnhance={handleEnhance}
                        isEnhancing={isEnhancing}
                        scenes={state.scenes}
                        onRegenerateScenes={state.handleRegenerateScenes}
                        isRegeneratingScenes={state.isRegeneratingScenes}
                        enableCaptions={state.enableCaptions}
                        setEnableCaptions={state.setEnableCaptions}
                        captionStyle={state.captionStyle}
                        setCaptionStyle={state.setCaptionStyle}
                        enableBackgroundMusic={state.enableBackgroundMusic}
                        setEnableBackgroundMusic={state.setEnableBackgroundMusic}
                        creditBalance={balance}
                        faceImageUrl={state.useStudioImage ? state.studioReadyUrl : state.photoPreview}
                    />
                }

                // Mobile props
                mode={state.mode}
                setMode={state.setMode}
                avatarUrl={state.useStudioImage ? state.studioReadyUrl : state.photoPreview}
                savedAvatars={state.savedAvatars}
                onSelectAvatar={handleSelectAvatar}
                onUploadAvatar={state.handlePhotoUpload}
                onDeleteAvatar={state.handleDeleteAvatar}
                useStudioImage={state.useStudioImage}
                studioReadyUrl={state.studioReadyUrl}
                isGeneratingStudio={state.isGeneratingStudio}
                onMakeStudioReady={state.handleMakeStudioReady}
                toggleStudioImage={() => state.setUseStudioImage(!state.useStudioImage)}
                voices={state.allVoices}
                selectedVoice={state.savedVoice}
                onSelectVoice={state.onVoiceSelect}
                isRecording={state.isRecording}
                onStartRecording={state.startRecording}
                onStopRecording={state.stopRecording}
                onUploadVoice={state.handleVoiceUpload}
                onDeleteVoice={state.handleDeleteVoice}
                voiceFile={state.voiceFile}
                onConfirmVoice={state.handleConfirmVoice}
                onClearVoice={() => state.setVoiceFile(null)}
                isConfirmingVoice={state.isConfirmingVoice}
                duration={state.duration}
                setDuration={state.setDuration}
                aspectRatio={state.aspectRatio}
                setAspectRatio={(r) => state.setAspectRatio(r as any)}
                editType={state.editType}
                setEditType={state.setEditType}
                script={state.inputText}
                assets={state.collectedAssets}
                onUploadAsset={handleUploadAsset}
                onRemoveAsset={(index) => state.setCollectedAssets(prev => prev.filter((_, i) => i !== index))}
                scenes={state.scenes}
                onRegenerateScenes={state.handleRegenerateScenes}
                isRegeneratingScenes={state.isRegeneratingScenes}
                videoUrl={state.videoUrl}
                videoHistory={state.videoHistory}
                onSelectVideo={state.handleSelectVideo}
                onDeleteVideo={state.handleDeleteVideo}
                inputText={state.inputText}
                setInputText={state.setInputText}
                onGenerate={state.handleCreateVideo}
                isProcessing={state.isProcessing}
                processingMessage={state.processingMessage}
                processingStep={state.processingStep}
                sceneProgress={state.sceneProgress}
                enableCaptions={state.enableCaptions}
                setEnableCaptions={state.setEnableCaptions}
                enableBackgroundMusic={state.enableBackgroundMusic}
                setEnableBackgroundMusic={state.setEnableBackgroundMusic}
                onEnhance={handleEnhance}
                onCollectAssets={handleCollectAssets}
                isEnhancing={isEnhancing}
                isCollectingAssets={isCollectingAssets}
                voiceName={state.savedVoice?.name ?? 'Select Voice'}
                hasScript={!!state.inputText && state.inputText.length > 10}
                hasAssets={state.collectedAssets.length > 0}
                hasStoryboard={state.scenes.length > 0}
                hasVideo={!!state.videoUrl || !!state.selectedVideo}
            />

            {/* Asset Gallery Modal (Overlay) - Desktop Only */}
            <AnimatePresence>
                {state.showAssetGallery && state.collectedAssets.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hidden lg:flex fixed inset-0 z-[60] items-center justify-center p-10 bg-black/60 backdrop-blur-sm"
                        onClick={() => state.setShowAssetGallery(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            className="w-full max-w-5xl h-full max-h-[80vh] bg-[var(--surface-2)] rounded-[var(--radius-lg)] p-6 shadow-2xl overflow-hidden flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold text-[var(--text-primary)]">📸 Collected Assets</h3>
                                    <p className="text-sm text-[var(--text-secondary)]">Found {state.collectedAssets.length} images</p>
                                </div>
                                <button onClick={() => state.setShowAssetGallery(false)} className="p-2 rounded-full hover:bg-[var(--surface-3)] text-[var(--text-primary)]">
                                    <CloseIcon />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-4 pr-2">
                                    {state.collectedAssets.map((asset, i) => (
                                        <div key={i} className="aspect-square rounded-lg overflow-hidden relative group">
                                            <img src={asset.thumbnail} alt={asset.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs px-2 text-center">
                                                {asset.title}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image Gallery Modal (Overlay) - Desktop Only */}
            <AnimatePresence>
                {state.showImagePreview && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hidden lg:flex fixed inset-0 z-[60] items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => state.setShowImagePreview(false)}
                    >
                        <motion.div
                            className="bg-[var(--surface-2)] p-6 rounded-[var(--radius-lg)] max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-[var(--text-primary)]">Your Photos</h3>
                                <button onClick={() => state.setShowImagePreview(false)}><CloseIcon /></button>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                {state.savedAvatars.map(avatar => (
                                    <button
                                        key={avatar.id}
                                        onClick={() => {
                                            handleSelectAvatar(avatar);
                                            state.setShowImagePreview(false);
                                        }}
                                        className="aspect-[3/4] rounded-lg overflow-hidden relative group"
                                    >
                                        <img src={avatar.image_url} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold">Select</div>
                                    </button>
                                ))}

                                <button className="aspect-[3/4] border-2 border-dashed border-[var(--border-subtle)] rounded-lg flex flex-col items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-3)]">
                                    <ImageIcon />
                                    <span className="text-sm mt-2">Upload New</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
