import { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import {
    generateScript,
    regenerateScenes,
    cloneVoice,
    generateSpeechWithVoiceId,
    createVideo,
    pollVideoStatus,
    handleApiError,
    generateElevenLabsSpeech,
    generateDynamicSRT,
    addBackgroundMusic,
    facePostProcess,
    generateOptimizedFaceVideo,
    startFaceVideoJob,
    pollFaceVideoJob,
    startFacelessVideoJob,
    pollFacelessVideoJob,
    FaceVideoSceneInput,
    WordTiming,
    collectAssets,
    CollectedAsset,
    Scene,
    SceneTiming,
    generateSceneBasedSpeech
} from '@/lib/apiClient';
import {
    getOrCreateUser,
    getAllVoices,
    saveVoice,
    setActiveVoice,
    updateVoiceId,
    getVideos,
    getVideoById,
    saveVideo,
    deleteVideo,
    saveAvatar,
    getAvatars,
    deleteAvatar,
    deleteVoice,
    saveDraft,
    updateDraft,
    uploadVoiceSample,
    getActiveVideoJobs,
    supabase,
    DbUser,
    DbVideo,
    DbVoice,
    DbAvatar
} from '@/lib/supabase';
import { convertToMp3, needsConversion } from '@/lib/audioConverter';

export const useDashboardState = () => {
    const { user, isLoaded } = useUser();

    // Theme state
    const [isDark, setIsDark] = useState(false);

    // Core state
    const [mode, setMode] = useState<'face' | 'faceless'>('face');
    const [duration, setDuration] = useState(30);
    const [inputText, setInputText] = useState('');
    const [isEnhanced, setIsEnhanced] = useState(false);
    const [enableCaptions, setEnableCaptions] = useState(true);
    const [captionStyle, setCaptionStyle] = useState('bold-classic');
    const [enableBackgroundMusic, setEnableBackgroundMusic] = useState(false);
    const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [originalTopic, setOriginalTopic] = useState(''); // Store the topic before enhancement
    const [previewMode, setPreviewMode] = useState<'idle' | 'face' | 'voice' | 'video' | 'assets' | 'script' | 'storyboard' | 'captions'>('idle');

    // Photo state
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState('');

    // Voice state
    const [voiceFile, setVoiceFile] = useState<File | null>(null);
    const [isConfirmingVoice, setIsConfirmingVoice] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);

    // Video state
    const [videoUrl, setVideoUrl] = useState('');
    const [audioUrl, setAudioUrl] = useState('');
    const [captionsData, setCaptionsData] = useState('');
    const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);

    // Processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMessage, setProcessingMessage] = useState('');
    const [processingStep, setProcessingStep] = useState(0);
    const [error, setError] = useState('');
    // Scene progress for checklist UI
    const [sceneProgress, setSceneProgress] = useState<{ totalScenes: number; currentSceneIndex: number; processedScenesCount: number; isRendering: boolean } | null>(null);

    // UI state
    const [showHistory, setShowHistory] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState<DbVideo | null>(null);

    // Collected assets state
    const [collectedAssets, setCollectedAssets] = useState<CollectedAsset[]>([]);
    const [isCollectingAssets, setIsCollectingAssets] = useState(false);
    const [showAssetGallery, setShowAssetGallery] = useState(false);
    const [assetSearchTerms, setAssetSearchTerms] = useState<string[]>([]);

    // Scene-based generation state
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [sceneTimings, setSceneTimings] = useState<SceneTiming[]>([]);

    // Studio ready image state
    const [studioReadyUrl, setStudioReadyUrl] = useState('');
    const [isGeneratingStudio, setIsGeneratingStudio] = useState(false);
    const [useStudioImage, setUseStudioImage] = useState(false);
    const [showImagePreview, setShowImagePreview] = useState(false);

    // Supabase state
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [savedVoice, setSavedVoice] = useState<DbVoice | null>(null);
    const [allVoices, setAllVoices] = useState<DbVoice[]>([]);
    const [videoHistory, setVideoHistory] = useState<DbVideo[]>([]);
    const [savedAvatars, setSavedAvatars] = useState<DbAvatar[]>([]);

    // Refs
    // const photoInputRef = useRef<HTMLInputElement>(null); // Managed in components now
    // const voiceInputRef = useRef<HTMLInputElement>(null); // Managed in components now

    // Initialization
    useEffect(() => {
        if (isLoaded && user) {
            initializeUser();
        }
    }, [isLoaded, user]);

    const initializeUser = async () => {
        if (!user) return;
        const dbUserData = await getOrCreateUser(user.id, user.primaryEmailAddress?.emailAddress || '', user.fullName || undefined, user.imageUrl || undefined);
        if (dbUserData) {
            setDbUser(dbUserData);
            const voices = await getAllVoices(dbUserData.id);
            setAllVoices(voices);
            const activeVoice = voices.find(v => v.is_active) || voices[0] || null;
            if (activeVoice) setSavedVoice(activeVoice);
            const videos = await getVideos(dbUserData.id);
            setVideoHistory(videos);
            const avatars = await getAvatars(dbUserData.id);
            setSavedAvatars(avatars);

            // Check for and resume any in-progress video jobs
            checkForActiveJobs(dbUserData.id);
        }
    };

    // Resume in-progress video jobs (e.g., after browser crash)
    const checkForActiveJobs = async (userId: string) => {
        try {
            const activeJobs = await getActiveVideoJobs(userId);
            if (activeJobs.length > 0) {
                const job = activeJobs[0]; // Resume the most recent one
                console.log(`[Resume] Found active job: ${job.id}, status: ${job.status}`);

                // Set UI to processing state
                setIsProcessing(true);
                setProcessingMessage(job.progress_message || 'Resuming video generation...');
                setProcessingStep(Math.floor((job.progress / 100) * 6));

                // Resume polling for this job
                try {
                    const result = await pollFaceVideoJob(
                        job.id,
                        (progress, message, sceneData) => {
                            setProcessingStep(Math.floor(4 + (progress / 100) * 2));
                            setProcessingMessage(message);
                            if (sceneData) setSceneProgress(sceneData);
                        }
                    );

                    setVideoUrl(result.videoUrl);
                    setProcessingMessage('Video ready!');
                    setPreviewMode('video');
                    await refreshVideoHistory();
                } catch (err) {
                    console.error('[Resume] Job failed:', err);
                    setError(`Failed to resume video: ${err instanceof Error ? err.message : 'Unknown error'}`);
                } finally {
                    setIsProcessing(false);
                    setSceneProgress(null);
                }
            }
        } catch (err) {
            console.error('[Resume] Error checking active jobs:', err);
        }
    };

    const refreshVideoHistory = async () => {
        if (dbUser) {
            const videos = await getVideos(dbUser.id);
            setVideoHistory(videos);
        }
    };

    const hasClonedVoice = !!savedVoice?.voice_id;

    // HANDLERS

    // Helper to upload avatar to storage and DB
    const uploadAvatar = async (file: File): Promise<string | null> => {
        if (!dbUser) return null;
        try {
            // 1. Upload to Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${dbUser.id}/${Date.now()}.${fileExt}`;
            const { data, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            // 3. Save to DB
            const savedAvatar = await saveAvatar(dbUser.id, publicUrl, 'Uploaded Avatar', false);

            // 4. Update Saved Avatars List
            if (savedAvatar) {
                setSavedAvatars(prev => [savedAvatar, ...prev]);
            }

            return publicUrl;
        } catch (err) {
            console.error('Avatar upload failed:', err);
            setError('Failed to upload image');
            return null;
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setProcessingMessage('Uploading image...');
            setIsProcessing(true);

            // Preview immediately (optimistic)
            const reader = new FileReader();
            reader.onloadend = () => setPhotoPreview(reader.result as string);
            reader.readAsDataURL(file);

            // Upload in background
            const publicUrl = await uploadAvatar(file);

            setIsProcessing(false);
            setProcessingMessage('');

            if (publicUrl) {
                setPhotoFile(null); // No longer needed as file
                setPhotoPreview(publicUrl); // Update to real URL
            }
        }
    };

    const handleEnhanceWithAI = async () => {
        if (!inputText.trim()) { setError('Please enter a topic first'); return; }
        setIsProcessing(true);
        setProcessingMessage(`Creating ${duration}s script...`);
        setError('');
        const topic = inputText; // Save the topic before replacing with script
        try {
            const result = await generateScript(inputText, duration);
            setInputText(result.script);
            if (result.scenes && result.scenes.length > 0) {
                setScenes(result.scenes);
            }
            setIsEnhanced(true);
            setOriginalTopic(topic);

            // Auto-save draft to Supabase
            if (dbUser) {
                const draft = await saveDraft(
                    dbUser.id,
                    topic,
                    result.script,
                    [],
                    mode,
                    aspectRatio,
                    duration
                );
                if (draft) {
                    setCurrentDraftId(draft.id);
                    console.log('Draft saved:', draft.id);
                }
            }
        } catch (err) {
            setError(handleApiError(err).message);
        }
        setIsProcessing(false);
    };

    // State for regenerating scenes
    const [isRegeneratingScenes, setIsRegeneratingScenes] = useState(false);

    const handleRegenerateScenes = async () => {
        if (!inputText.trim()) { setError('Please enter a script first'); return; }
        setIsRegeneratingScenes(true);
        setProcessingMessage('Updating storyboard...');
        setError('');
        try {
            const result = await regenerateScenes(inputText, duration);
            if (result.scenes && result.scenes.length > 0) {
                setScenes(result.scenes);
            }
        } catch (err) {
            setError(handleApiError(err).message);
        }
        setIsRegeneratingScenes(false);
        setProcessingMessage('');
    };

    const startRecording = async () => {
        try {
            // Import WAV recorder dynamically to avoid SSR issues
            const { getWavRecorder } = await import('@/lib/wavRecorder');
            const recorder = getWavRecorder();
            await recorder.start();
            setIsRecording(true);

            // Store reference for stopping
            setAudioRecorder(recorder as unknown as MediaRecorder);
        } catch { setError('Could not access microphone'); }
    };

    const stopRecording = () => {
        if (audioRecorder && isRecording) {
            const wavFile = (audioRecorder as unknown as { stop: () => File }).stop();
            setVoiceFile(wavFile);
            setSavedVoice(null); // Deselect saved voice to show recorded voice is active
            setIsRecording(false);
        }
    };

    const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVoiceFile(file);
            setSavedVoice(null); // Deselect saved voice to show uploaded voice is active
        }
    };

    const handleReset = () => {
        setPhotoFile(null); setPhotoPreview(''); setInputText(''); setIsEnhanced(false);
        setVoiceFile(null); setVideoUrl(''); setAudioUrl(''); setCaptionsData('');
        setWordTimings([]); setError(''); setProcessingStep(0);
        setCollectedAssets([]); setShowAssetGallery(false); setAssetSearchTerms([]);
        setStudioReadyUrl(''); setUseStudioImage(false);
    };

    const handleMakeStudioReady = async () => {
        if (!photoPreview) return;
        setIsGeneratingStudio(true);
        setError('');
        try {
            // Use persistent URL if available, otherwise data URL (should be persistent by now)
            const inputUrl = photoPreview;

            const response = await fetch('/api/make-studio-ready', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: inputUrl }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to generate studio image');

            setStudioReadyUrl(data.studioReadyUrl);
            setUseStudioImage(true);

            if (dbUser) {
                // Save the STUDIO READY version
                const savedStudioAvatar = await saveAvatar(dbUser.id, data.studioReadyUrl, 'Studio Ready', true);
                if (savedStudioAvatar) {
                    setSavedAvatars(prev => [savedStudioAvatar, ...prev]);
                }
            }
        } catch (err) {
            console.error('Make Studio Ready failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate studio image');
        }
        setIsGeneratingStudio(false);
    };

    const handleCollectAssets = async () => {
        if (!inputText.trim()) { setError('Please enter some content first'); return; }
        setIsCollectingAssets(true);
        setError('');
        try {
            const result = await collectAssets(inputText, originalTopic || inputText.slice(0, 100));
            setCollectedAssets(result.assets);
            setAssetSearchTerms(result.searchTerms);
            setShowAssetGallery(true);
            setPreviewMode('assets');

            // Update draft with collected assets
            if (currentDraftId && dbUser) {
                const assetsForDb = result.assets.map(a => ({
                    url: a.url,
                    source: a.source
                }));
                await updateDraft(currentDraftId, { assets: assetsForDb });
                console.log('Draft updated with assets:', assetsForDb.length);
            }
        } catch (err) {
            setError(handleApiError(err).message);
        }
        setIsCollectingAssets(false);
    };

    const handleDeleteVideo = async (videoId: string) => {
        await deleteVideo(videoId);
        await refreshVideoHistory();
        // Clear selected video if it was deleted
        if (selectedVideo?.id === videoId) {
            setSelectedVideo(null);
        }
    };

    // Delete avatar handler
    const handleDeleteAvatar = async (avatarId: string) => {
        await deleteAvatar(avatarId);
        setSavedAvatars(prev => prev.filter(a => a.id !== avatarId));
        // Clear photo preview if the deleted avatar was selected
        const deletedAvatar = savedAvatars.find(a => a.id === avatarId);
        if (deletedAvatar && photoPreview === deletedAvatar.image_url) {
            setPhotoPreview('');
        }
    };

    // Delete voice handler
    const handleDeleteVoice = async (voiceDbId: string) => {
        await deleteVoice(voiceDbId);
        setAllVoices(prev => prev.filter(v => v.id !== voiceDbId));
        // Clear selected voice if it was deleted
        if (savedVoice?.id === voiceDbId) {
            setSavedVoice(null);
        }
    };

    // Load video details from history (fetches full video data on-demand)
    const handleSelectVideo = async (video: DbVideo) => {
        // Set metadata immediately for fast UI response
        setSelectedVideo(video);
        setInputText(video.script || '');
        setOriginalTopic(video.topic || '');
        setMode(video.mode || 'faceless');
        setEnableCaptions(video.has_captions ?? false);
        setEnableBackgroundMusic(video.has_music ?? false);

        // Load assets if available
        if (video.assets && Array.isArray(video.assets)) {
            const loadedAssets: CollectedAsset[] = video.assets.map((asset: { url: string; source?: string }) => ({
                url: asset.url,
                thumbnail: asset.url,
                title: 'Loaded from history',
                source: asset.source || 'history',
                searchTerm: ''
            }));
            setCollectedAssets(loadedAssets);
        } else {
            setCollectedAssets([]);
        }

        setIsEnhanced(true);
        console.log('Loading video:', video.id);

        // Fetch full video data (including video_url and ASSETS) on-demand
        // Even if video_url exists, we might need assets which are now excluded from list view
        setProcessingMessage('Loading video details...');
        const fullVideo = await getVideoById(video.id);

        if (fullVideo) {
            // Update video URL if missing
            if (!video.video_url) {
                setVideoUrl(fullVideo.video_url);
            } else {
                setVideoUrl(video.video_url);
            }

            // CRITICAL: Load assets from full video fetch (since list view excludes them)
            if (fullVideo.assets && Array.isArray(fullVideo.assets)) {
                const loadedAssets: CollectedAsset[] = fullVideo.assets.map((asset: { url: string; source?: string }) => ({
                    url: asset.url,
                    thumbnail: asset.url,
                    title: 'Loaded from history',
                    source: asset.source || 'history',
                    searchTerm: ''
                }));
                setCollectedAssets(loadedAssets);
            }

            setSelectedVideo(fullVideo);
        } else {
            // Fallback if fetch fails
            setVideoUrl(video.video_url);
        }
        setProcessingMessage('');
        setPreviewMode('video');
    };



    const handleConfirmVoice = async () => {
        if (!voiceFile || !dbUser) return;

        try {
            setIsConfirmingVoice(true);

            // 0. Convert to MP3 if needed (client-side, avoids server FFmpeg issues)
            let fileToUpload = voiceFile;
            if (needsConversion(voiceFile)) {
                console.log('[Voice] Converting audio to MP3 on client...');
                setProcessingMessage('Converting voice format...');
                fileToUpload = await convertToMp3(voiceFile);
                console.log('[Voice] Conversion complete, new file:', fileToUpload.name, fileToUpload.size);
            }

            // 1. Upload the voice sample (now in MP3 format)
            const storageUrl = await uploadVoiceSample(dbUser.id, fileToUpload);
            if (!storageUrl) throw new Error('Failed to upload voice sample');

            // 2. Clone the voice IMMEDIATELY
            // logic moved from handleCreateVideo to here
            let voiceId = 'pending';
            let previewUrl = storageUrl;

            try {
                // Pass the URL instead of the file for faster/reliable cloning
                const voiceData = await cloneVoice(storageUrl);
                voiceId = voiceData.voiceId;
                previewUrl = voiceData.previewUrl; // Use generated preview if available
            } catch (cloneError) {
                console.error('Immediate cloning failed, saving as pending:', cloneError);
                // Fallback: save as pending if cloning service is down, so we don't lose the upload
            }

            // 3. Save to DB
            // Generate a unique name
            const voiceCount = allVoices.length + 1;
            const voiceName = `Custom Voice ${voiceCount}`;

            const newVoice = await saveVoice(
                dbUser.id,
                voiceId,
                storageUrl,
                voiceName,
                previewUrl
            );

            if (newVoice) {
                // 4. Select it and clear pending file
                await setActiveVoice(dbUser.id, newVoice.id);
                setSavedVoice(newVoice);
                setAllVoices(prev => [newVoice, ...prev]);
                setVoiceFile(null); // Clear pending file as it is now saved
            }
        } catch (error) {
            console.error('Failed to confirm voice:', error);
            setError('Failed to save voice. Please try again.');
        } finally {
            setIsConfirmingVoice(false);
        }
    };

    const onVoiceSelect = async (voice: DbVoice) => {
        if (dbUser) {
            await setActiveVoice(dbUser.id, voice.id);
            setSavedVoice(voice);
            setVoiceFile(null); // Clear recorded/uploaded voice to ensure this selection is used
            setAllVoices(prev => prev.map(v => ({ ...v, is_active: v.id === voice.id })));
        }
    };

    const canGenerate = mode === 'faceless'
        ? inputText.trim().length > 0
        : inputText.trim().length > 0 && photoPreview && (voiceFile || hasClonedVoice);


    const handleCreateVideo = async () => {
        if (!inputText.trim()) { setError('Please enter a script'); return; }
        setIsProcessing(true);
        setProcessingStep(1);
        setError('');

        try {
            // Determine voice ID to use
            let voiceIdToUse: string | undefined = undefined;

            if (mode === 'faceless') {
                setProcessingMessage('Generating speech...');

                // 1. If user uploaded/recorded a voice, clone it first
                if (voiceFile) {
                    setProcessingMessage('Cloning your voice...');
                    const voiceData = await cloneVoice(voiceFile);
                    voiceIdToUse = voiceData.voiceId;

                    // Save the cloned voice for future use
                    if (dbUser) {
                        const newVoice = await saveVoice(dbUser.id, voiceData.voiceId, voiceData.audioBase64, 'My Voice', voiceData.previewUrl);
                        if (newVoice) {
                            setSavedVoice(newVoice);
                            setAllVoices(prev => [newVoice, ...prev]);
                        }
                    }
                    setVoiceFile(null);
                    setProcessingMessage('Generating speech...');
                }
            }
            // 2. If user has a saved cloned voice, use that
            else if (savedVoice) {
                console.log('[Debug] Checking savedVoice:', savedVoice);
                console.log('[Debug] savedVoice.voice_id:', savedVoice.voice_id);
                console.log('[Debug] Type of voice_id:', typeof savedVoice.voice_id);

                // Check if the voice is "pending" or missing ID
                if (!savedVoice.voice_id || savedVoice.voice_id === 'pending' || savedVoice.voice_id === 'undefined') {
                    setProcessingMessage('Cloning your new voice...');
                    console.log('Cloning pending voice from:', savedVoice.voice_sample_url);

                    try {
                        // Use the URL directly for cloning (fast path)
                        const voiceData = await cloneVoice(savedVoice.voice_sample_url);
                        console.log('[Debug] Clone successful, new ID:', voiceData.voiceId);
                        voiceIdToUse = voiceData.voiceId;

                        // Update the voice record with the real ID
                        const updatedVoice = await updateVoiceId(savedVoice.id, voiceData.voiceId, voiceData.previewUrl);

                        // Update local state
                        if (updatedVoice) {
                            setSavedVoice(updatedVoice);
                            setAllVoices(prev => prev.map(v => v.id === updatedVoice.id ? updatedVoice : v));
                        }
                    } catch (err) {
                        console.error('Error cloning pending voice:', err);
                        setError('Failed to process your voice. Please record again.');
                        setIsProcessing(false);
                        return;
                    }
                } else {
                    console.log('[Debug] Using existing voice ID:', savedVoice.voice_id);
                    voiceIdToUse = savedVoice.voice_id;
                }
            }
            // 3. Last safety check
            if (voiceIdToUse === 'pending') {
                console.error('SafeGuard: Voice ID is still PENDING after checks');
                setError('Voice cloning incomplete. Please try selecting the voice again.');
                setIsProcessing(false);
                return;
            }

            // 4. No voice - will use default preset (may error if preset not accessible)

            let speechResult;

            // For FACELESS video, we now skip client-side generation and let the server handle it scene-by-scene
            if (mode === 'faceless') {
                console.log(`[Video] Starting scene-based faceless video job with ${scenes.length} scenes`);

                // Map scenes to assets (1:1 or loop assets)
                const facelessScenes = scenes.length > 0 ? scenes.map((scene, index) => ({
                    text: scene.text,
                    assetUrl: collectedAssets[index % collectedAssets.length]?.url || collectedAssets[0]?.url
                })) : [
                    // Fallback if no scenes parsed (e.g. manual text only), treat whole text as one scene
                    {
                        text: inputText,
                        assetUrl: collectedAssets[0]?.url
                    }
                ];

                setProcessingStep(2);
                setProcessingMessage('Creating video job...');

                const { jobId } = await startFacelessVideoJob(
                    facelessScenes,
                    voiceIdToUse || 'Voice3d303ed71767974077', // Default voice if none
                    aspectRatio,
                    captionStyle,
                    enableBackgroundMusic,
                    enableCaptions,
                    enableBackgroundMusic ? 'https://tfaumdiiljwnjmfnonrc.supabase.co/storage/v1/object/public/Bgmusic/Feeling%20Blue.mp3' : undefined,
                    dbUser?.id
                );

                setProcessingMessage('Rendering video (this may take a few minutes)...');

                // Poll for job completion with progress updates
                const videoResult = await pollFacelessVideoJob(
                    jobId,
                    (progress: number, message: string) => {
                        setProcessingStep(Math.floor(2 + (progress / 100) * 4)); // Steps 2-6
                        setProcessingMessage(message);
                    }
                );

                setVideoUrl(videoResult.videoUrl);
                if (dbUser) {
                    const assetsForDb = collectedAssets.map(a => ({ url: a.url, source: a.source }));
                    await saveVideo(dbUser.id, videoResult.videoUrl, inputText, 'faceless', videoResult.duration, enableCaptions, enableBackgroundMusic, undefined, originalTopic, assetsForDb);
                    await refreshVideoHistory();
                }
                // Reset processing state after faceless video is done
                setIsProcessing(false);
                setProcessingStep(0);
                return; // EXIT HERE for faceless
            }

            // --- FACE VIDEO LOGIC BELOW ---
            // We proceed to voice preparation/checking
            // The backend handles scene-based TTS for Face Video
            let speechUrl: string;

            if (voiceFile) {
                setProcessingMessage('Cloning your new voice...');
                const voiceData = await cloneVoice(voiceFile);
                if (dbUser) {
                    const newVoice = await saveVoice(dbUser.id, voiceData.voiceId, voiceData.audioBase64, 'My Voice', voiceData.previewUrl);
                    if (newVoice) {
                        setSavedVoice(newVoice);
                        setAllVoices(prev => [newVoice, ...prev]);
                    }
                }
                setProcessingStep(2);
                setProcessingMessage('Generating speech...');
                const result = await generateSpeechWithVoiceId(inputText, voiceData.voiceId);
                speechUrl = result.audioUrl;
                setVoiceFile(null);
            } else if (hasClonedVoice && savedVoice) {
                setProcessingStep(2);
                setProcessingMessage('Generating speech...');

                let activeVoiceId = savedVoice.voice_id;

                // Handle pending voice in FACE mode
                if (!activeVoiceId || activeVoiceId === 'pending' || activeVoiceId === 'undefined') {
                    console.log('[FaceMode] Cloning pending voice...');
                    try {
                        const voiceData = await cloneVoice(savedVoice.voice_sample_url);
                        activeVoiceId = voiceData.voiceId;

                        // Update DB
                        if (dbUser) {
                            await updateVoiceId(savedVoice.id, activeVoiceId, voiceData.previewUrl);
                            // Update local state is optional here as we use activeVoiceId variable, but good for UI
                            const updatedVoice = { ...savedVoice, voice_id: activeVoiceId, preview_url: voiceData.previewUrl };
                            setSavedVoice(updatedVoice);
                            setAllVoices(prev => prev.map(v => v.id === savedVoice.id ? updatedVoice : v));
                        }
                    } catch (err) {
                        console.error('Face mode cloning failed:', err);
                        setError('Failed to process custom voice.');
                        setIsProcessing(false);
                        return;
                    }
                }

                try {
                    const result = await generateSpeechWithVoiceId(inputText, activeVoiceId);
                    speechUrl = result.audioUrl;
                    if (result.reCloned && result.newVoiceId && dbUser) {
                        await updateVoiceId(savedVoice.id, result.newVoiceId, result.newPreviewUrl);
                        const updatedVoice = { ...savedVoice, voice_id: result.newVoiceId, preview_url: result.newPreviewUrl };
                        setSavedVoice(updatedVoice);
                        setAllVoices(prev => prev.map(v => v.id === savedVoice.id ? updatedVoice : v));
                    }
                } catch (voiceError: unknown) {
                    const errorCode = (voiceError as Error & { code?: string }).code;
                    if (errorCode === 'VOICE_EXPIRED') {
                        setProcessingMessage('Voice expired, re-cloning...');
                        const response = await fetch(savedVoice.voice_sample_url);
                        const blob = await response.blob();
                        const file = new File([blob], 'voice.webm', { type: blob.type || 'audio/webm' });
                        const voiceData = await cloneVoice(file);
                        if (dbUser) {
                            await updateVoiceId(savedVoice.id, voiceData.voiceId, voiceData.previewUrl);
                            const updatedVoice = { ...savedVoice, voice_id: voiceData.voiceId, preview_url: voiceData.previewUrl };
                            setSavedVoice(updatedVoice);
                            setAllVoices(prev => prev.map(v => v.id === savedVoice.id ? updatedVoice : v));
                        }
                        const result = await generateSpeechWithVoiceId(inputText, voiceData.voiceId);
                        speechUrl = result.audioUrl;
                    } else {
                        throw voiceError;
                    }
                }
            } else {
                throw new Error('No voice available. Please record or upload a voice sample.');
            }

            // SCENE-BASED face mode: Perfect sync with individual TTS per scene
            setProcessingStep(3);
            setProcessingMessage('Preparing scene-based video...');

            if (photoPreview && dbUser) {
                await saveAvatar(dbUser.id, useStudioImage && studioReadyUrl ? studioReadyUrl : photoPreview, 'Avatar', true);
            }

            // Determine image URL
            const faceImageUrl = useStudioImage && studioReadyUrl
                ? studioReadyUrl
                : (photoPreview || '');

            if (!faceImageUrl) {
                throw new Error('No photo available for face mode');
            }

            // Build scenes from script - alternate face/asset
            // If we have scene timings from enhance, use those; otherwise split the script
            const sceneInputs: FaceVideoSceneInput[] = [];

            if (sceneTimings && sceneTimings.length > 0) {
                // Use scene data from enhanced script
                let assetIndex = 0;
                for (let i = 0; i < sceneTimings.length; i++) {
                    const isAssetScene = i % 2 !== 0; // Alternate: face, asset, face, asset
                    sceneInputs.push({
                        text: sceneTimings[i].text,
                        type: isAssetScene && collectedAssets.length > 0 ? 'asset' : 'face',
                        assetUrl: isAssetScene && collectedAssets.length > 0
                            ? collectedAssets[assetIndex % collectedAssets.length].url
                            : undefined
                    });
                    if (isAssetScene && collectedAssets.length > 0) assetIndex++;
                }
            } else {
                // Fallback: Split script into sentences and alternate
                const sentences = inputText.split(/[.!?]+/).filter(s => s.trim().length > 0);
                let assetIndex = 0;
                for (let i = 0; i < sentences.length; i++) {
                    const isAssetScene = i % 2 !== 0;
                    sceneInputs.push({
                        text: sentences[i].trim() + '.',
                        type: isAssetScene && collectedAssets.length > 0 ? 'asset' : 'face',
                        assetUrl: isAssetScene && collectedAssets.length > 0
                            ? collectedAssets[assetIndex % collectedAssets.length].url
                            : undefined
                    });
                    if (isAssetScene && collectedAssets.length > 0) assetIndex++;
                }
            }

            console.log(`Face mode: Created ${sceneInputs.length} scenes (${sceneInputs.filter(s => s.type === 'face').length} face, ${sceneInputs.filter(s => s.type === 'asset').length} asset)`);

            setProcessingStep(4);
            setProcessingMessage(`Generating ${sceneInputs.length} scenes...`);

            // Get voice ID from saved voice (required for face mode)
            const voiceIdForScenes = savedVoice?.voice_id;

            if (!voiceIdForScenes) {
                throw new Error('No voice ID available for scene generation. Please record or clone a voice first.');
            }

            // Call job-based face video API (works on Vercel)
            const { jobId } = await startFaceVideoJob(
                sceneInputs,
                faceImageUrl,
                voiceIdForScenes,
                enableBackgroundMusic,
                enableCaptions,
                dbUser?.id
            );

            setProcessingMessage('Processing video (this may take a few minutes)...');

            // Poll for job completion with progress updates
            const sceneResult = await pollFaceVideoJob(
                jobId,
                (progress, message, sceneData) => {
                    setProcessingStep(Math.floor(4 + (progress / 100) * 2)); // Steps 4-6
                    setProcessingMessage(message);
                    if (sceneData) setSceneProgress(sceneData);
                }
            );

            setVideoUrl(sceneResult.videoUrl);

            // Save video with clip assets from WaveSpeed
            if (dbUser) {
                // Merge existing collected assets with new clip assets
                const allAssets = [
                    ...collectedAssets,
                    ...(sceneResult.clipAssets || [])
                ];
                await saveVideo(
                    dbUser.id,
                    sceneResult.videoUrl,
                    inputText,
                    'face',
                    sceneResult.duration,
                    enableCaptions,
                    enableBackgroundMusic,
                    undefined,
                    inputText,
                    allAssets  // Save all assets including WaveSpeed clips
                );
                await refreshVideoHistory();
            }
            setIsProcessing(false);
        } catch (err) {
            setError(handleApiError(err).message);
            setIsProcessing(false);
        } finally {
            if (!error) setPreviewMode('video');
        }
    };

    return {
        // State
        isDark, setIsDark,
        mode, setMode,
        duration, setDuration,
        inputText, setInputText,
        isEnhanced, setIsEnhanced,
        enableCaptions, setEnableCaptions,
        captionStyle, setCaptionStyle,
        enableBackgroundMusic, setEnableBackgroundMusic,
        aspectRatio, setAspectRatio,
        photoFile, setPhotoFile,
        photoPreview, setPhotoPreview,
        voiceFile, setVoiceFile,
        isRecording, startRecording, stopRecording,
        videoUrl, setVideoUrl,
        audioUrl,
        captionsData,
        wordTimings,
        isProcessing,
        processingMessage,
        processingStep,
        sceneProgress,
        error, setError,
        showHistory, setShowHistory,
        collectedAssets, setCollectedAssets,
        isCollectingAssets,
        showAssetGallery, setShowAssetGallery,
        assetSearchTerms,
        scenes, setScenes,
        sceneTimings, setSceneTimings,
        studioReadyUrl, setStudioReadyUrl,
        isGeneratingStudio,
        useStudioImage, setUseStudioImage,
        showImagePreview, setShowImagePreview,
        dbUser,
        savedVoice, setSavedVoice,
        allVoices, setAllVoices,
        videoHistory,
        savedAvatars,

        // Derived
        hasClonedVoice,
        canGenerate,

        // Handlers
        handlePhotoUpload,
        handleEnhanceWithAI,
        handleRegenerateScenes,
        isRegeneratingScenes,
        handleVoiceUpload,
        handleReset,
        handleMakeStudioReady,
        handleCollectAssets,
        handleDeleteVideo,
        handleDeleteAvatar,
        handleDeleteVoice,
        handleCreateVideo,
        handleSelectVideo,
        selectedVideo, setSelectedVideo,
        onVoiceSelect,
        handleConfirmVoice,
        isConfirmingVoice,
        previewMode, setPreviewMode
    };
};
