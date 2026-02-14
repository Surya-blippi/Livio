import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
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
    generateSceneBasedSpeech,
    createTypographyVideo
} from '@/lib/apiClient';
import { useCredits } from '../context/CreditsContext';
import { CREDIT_COSTS, estimateTotalCredits, calculateFacelessVideoCredits, calculateFaceVideoCredits } from '@/lib/credits';
import {
    getOrCreateUser,
    getAllVoices,
    updateVoiceId,
    getVideos,
    getVideoById,
    saveVideo,
    deleteVideo,
    getAvatars,
    deleteAvatar,
    deleteVoice,
    saveDraft,
    updateDraft,
    uploadVoiceSample,
    uploadAvatarImage,
    getActiveVideoJobs,
    DbUser,
    DbVideo,
    DbVoice,
    DbAvatar
} from '@/lib/supabase';
import { useSupabase } from "@/app/context/SupabaseProvider";
import { convertToMp3, needsConversion } from '@/lib/audioConverter';
import { showToast } from '@/lib/toast';

export const useDashboardState = () => {
    const { user, isLoaded: isUserLoaded } = useUser();
    const { checkCredits, checkCreditsWithContext } = useCredits();

    // Get single Supabase instance from context
    const supabaseClient = useSupabase();

    const getSupabase = useCallback(async () => {
        return supabaseClient;
    }, [supabaseClient]);

    // Theme state
    const [isDark, setIsDark] = useState(false);

    // Core state
    const [mode, setMode] = useState<'face' | 'faceless'>('face');
    const [editType, setEditType] = useState<'minimal' | 'motion' | 'typography'>('motion');
    const [duration, setDuration] = useState(30);
    const [inputText, setInputText] = useState('');
    const [isEnhanced, setIsEnhanced] = useState(false);
    const [enableCaptions, setEnableCaptions] = useState(true);
    const [captionStyle, setCaptionStyle] = useState('bold-classic');
    const [enableBackgroundMusic, setEnableBackgroundMusic] = useState(true);
    const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [originalTopic, setOriginalTopic] = useState(''); // Store the topic before enhancement
    const [previewMode, setPreviewMode] = useState<'idle' | 'face' | 'voice' | 'video' | 'assets' | 'script' | 'storyboard' | 'captions' | 'music'>('idle');

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
        if (isUserLoaded && user) {
            initializeUser();
        }
    }, [isUserLoaded, user, getSupabase]);

    const initializeUser = async () => {
        try {
            if (!user) return;

            const sb = await getSupabase();

            const { data: existing } = await sb
                .from('users')
                .select('*')
                .eq('clerk_id', user.id)
                .single();

            if (existing) {
                setDbUser(existing);

                // Load User Data
                const [videos, voices, avatars] = await Promise.all([
                    sb.from('videos').select('*').eq('user_id', existing.id).order('created_at', { ascending: false }),
                    sb.from('voices').select('*').eq('user_id', existing.id),
                    sb.from('avatars').select('*').eq('user_id', existing.id)
                ]);

                setAllVoices(voices.data || []);
                const activeVoice = (voices.data || []).find((v: DbVoice) => v.is_active) || (voices.data || [])[0] || null;
                if (activeVoice) setSavedVoice(activeVoice);
                setVideoHistory(videos.data || []);
                setSavedAvatars(avatars.data || []);

                // Auto-select avatar (Default > First Created)
                const defaultAvatar = (avatars.data || []).find((a: DbAvatar) => a.is_default);
                const firstAvatar = (avatars.data || [])[0];
                const avatarToUse = defaultAvatar || firstAvatar;

                if (avatarToUse) {
                    console.log('[Dashboard] Auto-selecting avatar:', avatarToUse.image_url);
                    setPhotoPreview(avatarToUse.image_url);
                    if (avatarToUse.is_default || avatarToUse.name?.includes('Studio')) {
                        setStudioReadyUrl(avatarToUse.image_url);
                        setUseStudioImage(true);
                    }
                }

                // Check for and resume any in-progress video jobs
                checkForActiveJobs(existing.id);
            } else {
                // Create new user
                const newUserCtx = {
                    clerk_id: user.id,
                    email: user.primaryEmailAddress?.emailAddress || '',
                    name: user.fullName || user.username || 'User',
                    image_url: user.imageUrl
                };

                const { data: newUser, error } = await sb
                    .from('users')
                    .insert(newUserCtx)
                    .select()
                    .single();

                if (newUser) setDbUser(newUser);
            }
        } catch (error) {
            console.error('Error initializing user:', error);
            setError('Failed to load user data.');
        }
    };

    // Resume in-progress video jobs (e.g., after browser refresh)
    const checkForActiveJobs = async (userId: string) => {
        try {
            const activeJobs = await getActiveVideoJobs(userId);
            if (activeJobs.length > 0) {
                const job = activeJobs[0]; // Resume the most recent one
                console.log(`[Resume] Found active job: ${job.id}, status: ${job.status}, type: ${job.job_type}`);

                // Determine job type (from job_type field or by checking input_data)
                const jobType = job.job_type || (job.input_data?.faceImageUrl ? 'face' : 'faceless') as 'face' | 'faceless' | 'typography';

                // If the job has been stuck (not updated in >60s), explicitly retrigger the process endpoint
                // Typography jobs use Remotion Lambda with frontend polling — they don't have a process endpoint
                const lastUpdated = new Date(job.updated_at).getTime();
                const staleMs = Date.now() - lastUpdated;
                if (staleMs > 60000 && (job.status === 'pending' || job.status === 'processing') && jobType !== 'typography') {
                    console.log(`[Resume] Job ${job.id} is stale (${Math.round(staleMs / 1000)}s), retriggering process...`);
                    const endpoint = jobType === 'face' ? '/api/face-video/process' : '/api/faceless-video/process';
                    fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jobId: job.id })
                    }).catch(err => console.error('[Resume] Retrigger failed:', err));
                }

                // Set UI to processing state
                setIsProcessing(true);
                setProcessingMessage(job.progress_message || 'Resuming video generation...');
                setProcessingStep(Math.floor((job.progress / 100) * 6));

                // Resume polling for this job based on type
                try {
                    if (jobType === 'faceless') {
                        console.log('[Resume] Resuming faceless video job...');
                        const result = await pollFacelessVideoJob(
                            job.id,
                            (progress, message, sceneData) => {
                                setProcessingStep(Math.floor(2 + (progress / 100) * 4));
                                setProcessingMessage(message);
                                if (sceneData) setSceneProgress(sceneData);
                            }
                        );
                        setVideoUrl(result.videoUrl);
                    } else {
                        console.log('[Resume] Resuming face video job...');
                        const result = await pollFaceVideoJob(
                            job.id,
                            (progress, message, sceneData) => {
                                setProcessingStep(Math.floor(4 + (progress / 100) * 2));
                                setProcessingMessage(message);
                                if (sceneData) setSceneProgress(sceneData);
                            }
                        );
                        setVideoUrl(result.videoUrl);
                    }

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
            console.log('[Dashboard] Refreshing video history for user:', dbUser.id);
            try {
                const sb = await getSupabase();
                const { data: videos, error } = await sb
                    .from('videos')
                    .select('id, user_id, script, topic, mode, duration, has_captions, has_music, thumbnail_url, created_at')
                    .eq('user_id', dbUser.id)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (error) {
                    console.error('[Dashboard] Failed to fetch history:', error);
                    return;
                }

                // Add empty video_url as per previous type contract (fetched on demand)
                const formattedVideos = (videos || []).map((v: any) => ({ ...v, video_url: '' }));
                console.log('[Dashboard] Fetched videos:', formattedVideos.length);
                setVideoHistory(formattedVideos);
            } catch (e) {
                console.error('[Dashboard] Error refreshing history:', e);
            }
        } else {
            console.warn('[Dashboard] Cannot refresh history: dbUser is null');
        }
    };

    const hasClonedVoice = !!savedVoice?.voice_id;

    const confirmDeletion = (message: string) => {
        if (typeof window === 'undefined') return true;
        return window.confirm(message);
    };

    // HANDLERS

    // Helper to upload avatar to storage and DB
    const uploadAvatar = async (file: File): Promise<string | null> => {
        if (!dbUser) return null;
        try {
            const sb = await getSupabase();
            // 1. Upload to Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${dbUser.id}/${Date.now()}.${fileExt}`;
            const { data, error: uploadError } = await sb.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = sb.storage
                .from('avatars')
                .getPublicUrl(fileName);

            // 3. Return Public URL (Saving handled by caller with auth client)
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
                setUseStudioImage(false); // Reset studio mode for new upload

                if (dbUser) {
                    // Save avatar via API route (bypasses RLS)
                    const saveRes = await fetch('/api/avatar/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrl: publicUrl, name: 'Original Upload', isDefault: false })
                    });
                    const saveData = await saveRes.json();
                    if (saveData.savedAvatar) {
                        setSavedAvatars(prev => [saveData.savedAvatar, ...prev]);
                    }
                }
            }
        }
    };

    const handleEnhanceWithAI = async () => {
        if (!inputText.trim()) { setError('Please enter a topic first'); return; }

        // Pre-check credits for script generation
        if (!checkCreditsWithContext(CREDIT_COSTS.RESEARCH_SCRIPT, 'Script Generation')) {
            return; // Modal will open automatically
        }

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

    const handleMakeStudioReady = async (style: string = 'professional') => {
        if (!photoPreview || !dbUser) return;

        // Check credits (45 credits)
        if (!checkCredits(CREDIT_COSTS.AI_IMAGE)) return;

        setIsGeneratingStudio(true);
        setError('');
        try {
            const sb = await getSupabase();

            // 1. If we have a raw file, upload it and save "Original" first
            let inputUrl = photoPreview;
            if (photoFile) {
                console.log('[Avatar] Uploading original file first...');
                const publicUrl = await uploadAvatarImage(dbUser.id, photoFile);
                if (publicUrl) {
                    inputUrl = publicUrl;

                    // Save Original to DB via API route (bypasses RLS)
                    const saveRes = await fetch('/api/avatar/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrl: publicUrl, name: 'My Photo', isDefault: false })
                    });
                    const saveData = await saveRes.json();

                    if (saveData.savedAvatar) {
                        setSavedAvatars(prev => {
                            // Deduplicate
                            const exists = prev.some(a => a.image_url === saveData.savedAvatar.image_url);
                            return exists ? prev : [saveData.savedAvatar, ...prev];
                        });
                        // Update preview to use the remote URL
                        setPhotoPreview(publicUrl);
                    }
                }
            }

            const response = await fetch('/api/make-studio-ready', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: inputUrl, style }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to generate studio image');

            // Store the studio-ready URL but DON'T replace the original photoPreview
            // User can select either from the avatar grid
            setStudioReadyUrl(data.studioReadyUrl);
            setUseStudioImage(false); // Don't auto-switch, let user choose

            if (dbUser) {
                // Refresh avatars list to get the one saved by server
                const sb = await getSupabase();
                const { data: latestAvatars } = await sb
                    .from('avatars')
                    .select('*')
                    .eq('user_id', dbUser.id)
                    .order('created_at', { ascending: false });

                if (latestAvatars) {
                    setSavedAvatars(latestAvatars);
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

        // Pre-check credits for asset collection
        if (!checkCreditsWithContext(CREDIT_COSTS.ASSET_COLLECTION, 'Asset Collection')) {
            return; // Modal will open automatically
        }

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

    // Upload a user asset immediately to Supabase and return the public URL
    const uploadAsset = async (file: File): Promise<string | null> => {
        if (!dbUser) {
            setError('Please sign in to upload assets');
            return null;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', dbUser.id);

            const response = await fetch('/api/assets/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const data = await response.json();
            console.log('✅ Asset uploaded:', data.url);
            return data.url;
        } catch (err) {
            console.error('Asset upload error:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload asset');
            return null;
        }
    };

    // Add a user-uploaded asset (uploads immediately to Supabase)
    const addUserAsset = async (file: File) => {
        setIsCollectingAssets(true);
        try {
            const url = await uploadAsset(file);
            if (url) {
                setCollectedAssets(prev => [...prev, {
                    url,
                    thumbnail: url, // Use same URL as thumbnail
                    source: 'upload',
                    title: file.name,
                    searchTerm: 'user-upload',
                    isUploaded: true
                }]);
                setShowAssetGallery(true);
                setPreviewMode('assets');
            }
        } finally {
            setIsCollectingAssets(false);
        }
    };

    const handleDeleteVideo = async (videoId: string) => {
        if (!confirmDeletion('Delete this project permanently? This cannot be undone.')) return;

        try {
            await deleteVideo(videoId);
            await refreshVideoHistory();
            // Clear selected video if it was deleted
            if (selectedVideo?.id === videoId) {
                setSelectedVideo(null);
            }
            showToast({ type: 'success', message: 'Project deleted.' });
        } catch (err) {
            console.error('Delete video failed:', err);
            setError('Failed to delete project.');
            showToast({ type: 'error', message: 'Failed to delete project.' });
        }
    };

    // Delete avatar handler
    const handleDeleteAvatar = async (avatarId: string) => {
        if (!confirmDeletion('Delete this avatar permanently?')) return;

        try {
            await deleteAvatar(avatarId);
            setSavedAvatars(prev => prev.filter(a => a.id !== avatarId));
            // Clear photo preview if the deleted avatar was selected
            const deletedAvatar = savedAvatars.find(a => a.id === avatarId);
            if (deletedAvatar && photoPreview === deletedAvatar.image_url) {
                setPhotoPreview('');
            }
            showToast({ type: 'success', message: 'Avatar deleted.' });
        } catch (err) {
            console.error('Delete avatar failed:', err);
            setError('Failed to delete avatar.');
            showToast({ type: 'error', message: 'Failed to delete avatar.' });
        }
    };

    // Delete voice handler
    const handleDeleteVoice = async (voiceDbId: string) => {
        if (!confirmDeletion('Delete this voice permanently?')) return;

        try {
            await deleteVoice(voiceDbId);
            setAllVoices(prev => prev.filter(v => v.id !== voiceDbId));
            // Clear selected voice if it was deleted
            if (savedVoice?.id === voiceDbId) {
                setSavedVoice(null);
            }
            showToast({ type: 'success', message: 'Voice deleted.' });
        } catch (err) {
            console.error('Delete voice failed:', err);
            setError('Failed to delete voice.');
            showToast({ type: 'error', message: 'Failed to delete voice.' });
        }
    };

    // Load video details from history (fetches full video data on-demand)
    const handleSelectVideo = async (video: DbVideo) => {
        // Set metadata immediately for fast UI response
        setSelectedVideo(video);

        // Parse script - it might be stored as JSON (array of scenes or object with scenes property)
        let scriptText = video.script || '';
        try {
            const parsed = JSON.parse(scriptText);
            if (Array.isArray(parsed)) {
                // Extract text from each scene object (array format)
                scriptText = parsed.map((s: { text?: string }) => s.text || '').join('\n\n');
            } else if (parsed && parsed.scenes && Array.isArray(parsed.scenes)) {
                // Extract text from scenes property (object format: {"scenes": [...]})
                scriptText = parsed.scenes.map((s: { text?: string }) => s.text || '').join('\n\n');
            }
        } catch {
            // Not JSON, use as-is (already plain text)
        }
        setInputText(scriptText);

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

        // Pre-check credits for voice cloning
        if (!checkCreditsWithContext(CREDIT_COSTS.VOICE_CLONING, 'Voice Cloning')) {
            return; // Modal will open automatically
        }

        try {
            console.log('[handleConfirmVoice] Starting voice confirmation');
            console.log('[handleConfirmVoice] dbUser:', dbUser);
            if (dbUser) {
                console.log('[handleConfirmVoice] dbUser.id:', dbUser.id, 'isUUID:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbUser.id));
                console.log('[handleConfirmVoice] dbUser.clerk_id:', dbUser.clerk_id);
            }

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

            // 2. Clone the voice - the API now saves to DB and returns the voice object
            setProcessingMessage('Cloning your voice...');
            const voiceData = await cloneVoice(storageUrl);

            // The clone-voice API now saves the voice and returns it
            if (voiceData.savedVoice) {
                // Voice was saved by the API, use it directly
                const newVoice = voiceData.savedVoice;
                setSavedVoice(newVoice);
                setAllVoices(prev => [newVoice, ...prev.filter(v => v.id !== newVoice.id)]);
                setVoiceFile(null); // Clear pending file as it is now saved
            } else {
                // Fallback: voice cloning succeeded but no saved voice returned
                // This shouldn't happen with the updated API, but handle gracefully
                console.warn('Voice cloned but not saved to DB by API');
                setVoiceFile(null);
            }
        } catch (error) {
            console.error('Failed to confirm voice:', error);
            setError('Failed to save voice. Please try again.');
        } finally {
            setIsConfirmingVoice(false);
            setProcessingMessage('');
        }
    };

    const onVoiceSelect = async (voice: DbVoice) => {
        if (dbUser) {
            // Set active voice via API route (bypasses RLS)
            const response = await fetch('/api/voice/set-active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voiceId: voice.id })
            });
            const data = await response.json();
            if (data.voice) {
                setSavedVoice(data.voice);
            } else {
                setSavedVoice(voice);
            }
            setVoiceFile(null); // Clear recorded/uploaded voice to ensure this selection is used
            setAllVoices(prev => prev.map(v => ({ ...v, is_active: v.id === voice.id })));
        }
    };

    const canGenerate = mode === 'faceless'
        ? inputText.trim().length > 0
        : inputText.trim().length > 0 && photoPreview && (voiceFile || hasClonedVoice);


    const handleCreateVideo = async () => {
        if (isProcessing) return; // Prevent double-submission
        if (!inputText.trim()) { setError('Please enter a script'); return; }
        if (!dbUser) { setError('Please sign in to create videos'); return; }

        // --- PRE-FLIGHT CHECKS FOR FACE MODE ---
        // Guide users to set up avatar and voice before generating
        // Skip for typography mode which doesn't need avatar or voice setup
        if (mode === 'face' && editType !== 'typography') {
            // Check if avatar/face is set
            const hasAvatar = photoPreview || (useStudioImage && studioReadyUrl);
            if (!hasAvatar) {
                setPreviewMode('face');
                setError("✨ Let's first get you studio ready! Upload or select your avatar.");
                return;
            }

            // Check if voice is set
            const hasVoice = voiceFile || hasClonedVoice;
            if (!hasVoice) {
                setPreviewMode('voice');
                setError("🎤 Now let's clone your voice! Record or upload a voice sample.");
                return;
            }
        }

        // --- PRE-FLIGHT CHECKS FOR FACELESS MODE ---
        // Skip for typography mode which doesn't need assets
        if (mode === 'faceless' && editType !== 'typography') {
            // Check if voice is set (faceless also needs TTS)
            const hasVoice = voiceFile || hasClonedVoice;
            if (!hasVoice) {
                setPreviewMode('voice');
                setError("🎤 Let's clone your voice first! Record or upload a voice sample.");
                return;
            }

            // Check if assets are collected
            if (collectedAssets.length === 0) {
                setPreviewMode('assets');
                setError("🖼️ Let's add some visuals! Upload or collect images for your video.");
                return;
            }
        }
        // ----------------------------------------

        // --- AUTO-PARSE SCENES IF EMPTY OR STALE ---
        // If user has script but no scenes (didn't click Research), parse script into scenes
        // Also re-parse if user edited the script after scenes were generated
        let workingScenes = scenes;

        // Check if scenes are stale (user edited inputText after scene generation)
        if (scenes.length > 0 && inputText.trim().length > 0) {
            const scenesText = scenes.map(s => s.text).join(' ').trim();
            const currentText = inputText.trim();
            // If the concatenated scene text differs from inputText, scenes are stale
            if (scenesText !== currentText) {
                console.log('[Video] Script was edited after scenes were generated — re-parsing scenes from current text');
                workingScenes = []; // Force re-parse below
            }
        }

        if (workingScenes.length === 0 && inputText.trim().length > 0) {
            // Split script by sentences (periods, ! or ?) into individual scenes
            // Split script by sentences (periods, ! or ?) or newlines into individual scenes
            const sentences = inputText
                .split(/(?<=[.!?])\s+|\n+/)
                .map(s => s.trim())
                .filter(s => s.length > 0);

            // Group sentences into scenes
            // Default to 1 sentence per scene for better pacing/more asset slots
            const scenesPerGroup = 1;

            const autoScenes: Scene[] = [];
            let buffer = '';

            for (let i = 0; i < sentences.length; i++) {
                const currentSentence = sentences[i];
                buffer += (buffer ? ' ' : '') + currentSentence;

                const wordCount = buffer.split(/\s+/).length;

                // Create scene if:
                // 1. We hit the group limit (1 sentence)
                // 2. OR the buffer is getting too long (>30 words)
                // 3. BUT keep appending if the current buffer is too short (<5 words) and it's not the end
                const isLongEnough = wordCount >= 5;
                const isTooLong = wordCount >= 30;
                const isGroupFull = (i + 1) % scenesPerGroup === 0;
                const isLast = i === sentences.length - 1;

                if ((isGroupFull && isLongEnough) || isTooLong || isLast) {
                    autoScenes.push({ text: buffer, keywords: [] });
                    buffer = '';
                }
            }

            // Fallback: if no sentences parsed, use whole script as one scene
            if (autoScenes.length === 0) {
                autoScenes.push({ text: inputText.trim(), keywords: [] });
            }

            workingScenes = autoScenes;
            setScenes(autoScenes);
            console.log(`[Video] Auto-parsed ${autoScenes.length} scenes from script`);
        }
        // -----------------------------------

        // --- CREDIT PRE-CHECK ---
        let estimatedCost = 0;
        if (editType === 'typography') {
            // Typography mode: fixed cost
            estimatedCost = 20; // 20 credits for typography video
        } else if (mode === 'faceless') {
            // Use scene count to match backend: (sceneCount * 30) + 80 render
            const sceneCount = workingScenes.length > 0 ? workingScenes.length : 1;
            estimatedCost = calculateFacelessVideoCredits(sceneCount);
        } else {
            // Face mode: (Face Scenes * 100) + 80 render fee
            const faceSceneCount = workingScenes.length > 0 ? workingScenes.length : 1;
            estimatedCost = calculateFaceVideoCredits(faceSceneCount) + CREDIT_COSTS.VIDEO_RENDER;

            // Motion editing: Add cost for AI images on alternating scenes (every other scene)
            if (editType === 'motion') {
                const motionSceneCount = Math.floor(faceSceneCount / 2); // Every other scene gets AI image
                estimatedCost += motionSceneCount * CREDIT_COSTS.MOTION_SCENE_IMAGE;
            }
        }

        if (!checkCredits(estimatedCost)) return;
        // ------------------------

        setIsProcessing(true);
        setProcessingStep(1);
        setError('');

        try {
            // ========== TYPOGRAPHY MODE ==========
            if (editType === 'typography') {
                console.log('[Typography] Starting typography video generation');
                setProcessingMessage('Generating voiceover...');

                // Determine voice sample URL to use (Chatterbox uses audio URL directly)
                let voiceSampleUrlForTypography: string | undefined = undefined;

                if (savedVoice && savedVoice.voice_sample_url) {
                    voiceSampleUrlForTypography = savedVoice.voice_sample_url;
                    console.log('[Typography] Using saved voice sample URL:', voiceSampleUrlForTypography);
                } else {
                    console.log('[Typography] Using default voice (no saved voice)');
                }

                // Generate TTS audio with word timings using user's voice (Chatterbox)
                const speechResult = await generateElevenLabsSpeech(inputText, undefined, voiceSampleUrlForTypography);
                const { audioUrl, wordTimings, duration } = speechResult;

                console.log(`[Typography] Got ${wordTimings.length} words, duration: ${duration}s`);

                setProcessingStep(2);
                setProcessingMessage('Creating animated text video...');

                // Convert data URL audio to base64
                const audioBase64 = audioUrl.includes('base64,')
                    ? audioUrl.split('base64,')[1]
                    : audioUrl;

                // Render typography video
                const videoResult = await createTypographyVideo(audioBase64, wordTimings, {
                    wordsPerGroup: 3,
                    animationStyle: 'pop',
                    aspectRatio: aspectRatio as '9:16' | '16:9' | '1:1'
                });

                setVideoUrl(videoResult.videoUrl);

                // Save to history
                if (dbUser) {
                    const freshSb = await getSupabase();
                    await saveVideo(
                        dbUser.id,
                        videoResult.videoUrl,
                        inputText,
                        'faceless', // Use faceless for db schema compatibility
                        videoResult.duration,
                        false, // No captions overlay needed (text is the video)
                        enableBackgroundMusic,
                        undefined,
                        'Typography Video',
                        [],
                        freshSb
                    );
                    await refreshVideoHistory();
                }

                setIsProcessing(false);
                setProcessingStep(0);
                return; // EXIT for typography mode
            }
            // =====================================

            // Determine voice ID to use
            let voiceIdToUse: string | undefined = undefined;

            if (mode === 'faceless') {
                console.log(`[Video] Starting scene-based faceless video job with ${scenes.length} scenes`);

                // Validate we have content to work with
                if (scenes.length === 0 && !inputText.trim()) {
                    setError('Please generate or enter a script first');
                    setIsProcessing(false);
                    return;
                }

                // Assets check is now handled in pre-flight validation above

                // Map scenes to assets (1:1 or loop assets)
                // Map scenes to assets (1:1 or loop assets)
                // USE workingScenes (which includes auto-parsed scenes) instead of stale 'scenes' state
                const facelessScenes = workingScenes.length > 0 ? workingScenes.map((scene, index) => ({
                    text: scene.text,
                    assetUrl: collectedAssets[index % collectedAssets.length]?.url || collectedAssets[0]?.url
                })) : (() => {
                    // Fallback only if workingScenes is somehow empty
                    return [{ text: inputText, assetUrl: collectedAssets[0]?.url }];
                })();

                setProcessingStep(2);
                setProcessingMessage('Creating video job...');

                const sb = await getSupabase();
                const selectedVoiceId = voiceIdToUse || 'Voice3d303ed71767974077'; // Default voice if none
                const finalScenes = facelessScenes;

                console.log('Creating Faceless Job:', JSON.stringify({
                    user_id: dbUser.id,
                    user_uuid: dbUser.id,
                    job_type: 'faceless',
                }, null, 2));

                // USE SERVER-SIDE API for insertion to avoid RLS/Type issues
                const response = await fetch('/api/video-jobs/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        job_type: 'faceless',
                        user_id: dbUser.id,
                        input_data: {
                            scenes: finalScenes,
                            voiceId: selectedVoiceId, // Legacy - kept for backward compat
                            voiceSampleUrl: savedVoice?.voice_sample_url, // New - for Chatterbox TTS
                            aspectRatio,
                            captionStyle,
                            enableBackgroundMusic,
                            enableCaptions,
                            allAssets: collectedAssets.map(a => a.url)
                        }
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to create job via API');
                }

                const { job: videoJob } = await response.json();

                if (!videoJob) throw new Error('Failed to create video job.');

                const jobId = videoJob.id;

                setProcessingMessage('Rendering video (this may take a few minutes)...');

                // Poll for job completion with progress updates
                const videoResult = await pollFacelessVideoJob(
                    jobId,
                    (progress: number, message: string, sceneData) => {
                        setProcessingStep(Math.floor(2 + (progress / 100) * 4)); // Steps 2-6
                        setProcessingMessage(message);
                        if (sceneData) setSceneProgress(sceneData);
                    }
                );

                setVideoUrl(videoResult.videoUrl);

                // Video is saved server-side by faceless-video/process.
                // Just refresh the history list.
                if (dbUser) {
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
                // Voice is saved by the clone-voice API, use the returned savedVoice
                if (voiceData.savedVoice) {
                    setSavedVoice(voiceData.savedVoice);
                    setAllVoices(prev => [voiceData.savedVoice, ...prev]);
                }
                setProcessingStep(2);
                setProcessingMessage('Generating speech...');
                setProcessingMessage('Generating speech...');
                try {
                    const result = await generateSpeechWithVoiceId(inputText, voiceData.voiceId);
                    speechUrl = result.audioUrl;
                } catch (speechErr: any) {
                    console.error('Speech generation details:', speechErr);
                    // If the error object has a 'message' that is JSON, parse it
                    let msg = speechErr.message || 'Unknown speech error';
                    try {
                        const parsed = JSON.parse(msg);
                        if (parsed.error) msg = parsed.error;
                    } catch (e) { }

                    setError(`Speech failed: ${msg}`);
                    setIsProcessing(false);
                    return;
                }
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
                } catch (voiceError: any) {
                    console.error('Speech API Error Payload:', voiceError);

                    const errorCode = (voiceError as Error & { code?: string }).code;

                    if (errorCode === 'VOICE_EXPIRED') {
                        setProcessingMessage('Voice expired, re-cloning...');
                        // Ensure we have a sample URL to clone from
                        if (!savedVoice.voice_sample_url) {
                            throw new Error('Cannot re-clone: missing voice sample URL');
                        }

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
                        // Standard error logging
                        let msg = voiceError.message || 'Speech generation failed';
                        if (msg.includes('{')) {
                            try {
                                const parsed = JSON.parse(msg);
                                if (parsed.error) msg = parsed.error;
                            } catch { }
                        }
                        setError(`Speech Generation Error: ${msg}`);
                        setIsProcessing(false);
                        return;
                    }
                }
            } else {
                throw new Error('No voice available. Please record or upload a voice sample.');
            }

            // SCENE-BASED face mode: Perfect sync with individual TTS per scene
            setProcessingStep(3);
            setProcessingMessage('Preparing scene-based video...');

            if (photoPreview && dbUser) {
                // Save avatar via API route (bypasses RLS)
                await fetch('/api/avatar/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageUrl: useStudioImage && studioReadyUrl ? studioReadyUrl : photoPreview,
                        name: 'Avatar',
                        isDefault: true
                    })
                });
            }

            // Determine image URL
            const faceImageUrl = useStudioImage && studioReadyUrl
                ? studioReadyUrl
                : (photoPreview || '');

            if (!faceImageUrl) {
                throw new Error('No photo available for face mode');
            }

            // Build scenes from script
            // Motion editing: Alternates face and AI-generated images
            // Minimal editing: Single continuous face or use collected assets
            const sceneInputs: FaceVideoSceneInput[] = [];

            // Determine which assets to use for alternating scenes
            let assetsForAlternating: { url: string }[] = [];

            if (editType === 'motion' && workingScenes.length > 1) {
                // MOTION EDITING: Generate AI images for alternating (even) scenes
                setProcessingMessage('Generating AI visuals for motion editing...');

                // Only generate images for even-indexed scenes (0-indexed: 1, 3, 5... = scene 2, 4, 6...)
                const scenesNeedingImages = workingScenes.filter((_, i) => i % 2 === 1);

                if (scenesNeedingImages.length > 0) {
                    try {
                        const imageResponse = await fetch('/api/generate-scene-images', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                scenes: scenesNeedingImages,
                                topic: inputText.substring(0, 100)
                            })
                        });

                        if (!imageResponse.ok) {
                            const errData = await imageResponse.json();
                            console.error('Motion image generation failed:', errData);
                            // Fallback to minimal editing if image generation fails
                            setProcessingMessage('AI image generation failed, using minimal editing...');
                        } else {
                            const imageData = await imageResponse.json();
                            if (imageData.images && imageData.images.length > 0) {
                                assetsForAlternating = imageData.images.map((img: { imageUrl: string }) => ({ url: img.imageUrl }));
                                console.log(`Motion editing: Generated ${assetsForAlternating.length} AI images for alternating scenes`);
                            }
                        }
                    } catch (imgErr) {
                        console.error('Motion image API error:', imgErr);
                        // Continue with minimal editing if API fails
                    }
                }
            } else if (collectedAssets.length > 0) {
                // Use user-collected assets for alternating
                assetsForAlternating = collectedAssets;
            }

            if (assetsForAlternating.length === 0 && editType !== 'motion') {
                // NO ASSETS & MINIMAL: Single continuous face scene with entire script
                console.log('Face mode: No assets collected - generating single continuous face video');
                sceneInputs.push({
                    text: inputText.trim(),
                    type: 'face',
                    assetUrl: undefined
                });
            } else if (workingScenes.length > 0 && assetsForAlternating.length > 0) {
                // WITH ASSETS (user or AI-generated): Alternate face/asset
                let assetIndex = 0;
                for (let i = 0; i < workingScenes.length; i++) {
                    const isAssetScene = i % 2 === 1; // Scene 2, 4, 6... are asset scenes (0-indexed: 1, 3, 5...)
                    sceneInputs.push({
                        text: workingScenes[i].text,
                        type: isAssetScene ? 'asset' : 'face',
                        assetUrl: isAssetScene
                            ? assetsForAlternating[assetIndex % assetsForAlternating.length].url
                            : undefined
                    });
                    if (isAssetScene) assetIndex++;
                }
            } else if (sceneTimings && sceneTimings.length > 0) {
                // WITH SCENE TIMINGS: Alternate face/asset
                let assetIndex = 0;
                for (let i = 0; i < sceneTimings.length; i++) {
                    const isAssetScene = i % 2 !== 0; // Alternate: face, asset, face, asset
                    sceneInputs.push({
                        text: sceneTimings[i].text,
                        type: isAssetScene ? 'asset' : 'face',
                        assetUrl: isAssetScene
                            ? assetsForAlternating[assetIndex % assetsForAlternating.length]?.url
                            : undefined
                    });
                    if (isAssetScene) assetIndex++;
                }
            } else {
                // Fallback: Single face scene
                console.log('Face mode: Fallback - generating single continuous face video');
                sceneInputs.push({
                    text: inputText.trim(),
                    type: 'face',
                    assetUrl: undefined
                });
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
            const sb = await getSupabase();
            const avatarUrl = faceImageUrl;
            const selectedVoiceId = voiceIdForScenes;
            const scenesToProcess = sceneInputs;

            console.log('Creating Face Job:', {
                user_id: dbUser.id,
                user_uuid: dbUser.id,
                job_type: 'face',
            });

            // USE SERVER-SIDE API for insertion to avoid RLS/Type issues
            const response = await fetch('/api/video-jobs/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job_type: 'face',
                    user_id: dbUser.id,
                    input_data: {
                        scenes: scenesToProcess,
                        faceImageUrl: avatarUrl,
                        voiceId: selectedVoiceId, // Legacy - kept for backward compat
                        voiceSampleUrl: savedVoice?.voice_sample_url, // New - for Chatterbox TTS
                        enableBackgroundMusic,
                        enableCaptions
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create job via API');
            }

            const { job: videoJob } = await response.json();

            if (!videoJob) throw new Error('Failed to create video job.');

            const jobId = videoJob.id;

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

            const finalVideoUrl = sceneResult.videoUrl;
            setVideoUrl(finalVideoUrl);

            // Video is saved server-side by face-video/process.
            // Just refresh the history list.
            if (dbUser) {
                await refreshVideoHistory();
            }
            setIsProcessing(false);
            setProcessingStep(0);
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
        editType, setEditType,
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
        addUserAsset, // New: upload user assets immediately
        selectedVideo, setSelectedVideo,
        onVoiceSelect,
        handleConfirmVoice,
        isConfirmingVoice,
        previewMode, setPreviewMode
    };
};
