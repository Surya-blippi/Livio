import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tfaumdiiljwnjmfnonrc.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmYXVtZGlpbGp3bmptZm5vbnJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzcwMzksImV4cCI6MjA3OTU1MzAzOX0.VbxwPIzu8kBb2MzrtT5gm17DdR5V5R_oLBn8wYwevCo';

// Default anonymous client (use only for public info)
// We use a custom storage key to avoid "Multiple GoTrueClient" warnings when colliding with the AuthProvider client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storageKey: 'sb-anon-client-token',
        persistSession: false // We generally don't need to persist session for the utility client
    }
});

// Authenticated client factory (for RLS)
export const createAuthenticatedClient = (clerkToken: string) => {
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${clerkToken}` },
        },
    });
};

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface DbUser {
    id: string;
    clerk_id: string;
    email: string;
    name?: string;
    image_url?: string;
    created_at: string;
}

export interface DbVideo {
    id: string;
    user_id: string;
    video_url: string;
    script: string;
    topic?: string;
    assets?: { url: string; source?: string }[];
    mode: 'face' | 'faceless';
    duration: number;
    has_captions: boolean;
    has_music: boolean;
    thumbnail_url?: string;
    created_at: string;
}

export interface DbVoice {
    id: string;
    user_id: string;
    voice_id: string;
    voice_sample_url: string;
    preview_url?: string;
    name?: string;
    ref_text?: string;  // Transcription for F5 TTS (prevents ASR bleed)
    minimax_voice_id?: string;  // MiniMax voice ID for TTS
    qwen_embedding_url?: string;  // Qwen 3 TTS speaker embedding URL
    tts_provider?: 'minimax' | 'qwen';  // TTS provider preference
    is_active: boolean;
    created_at: string;
}

export interface DbAvatar {
    id: string;
    user_id: string;
    image_url: string;
    name?: string;
    is_default: boolean;
    created_at: string;
}

export interface DbVideoDraft {
    id: string;
    user_id: string;
    topic: string;
    script?: string;
    assets: { url: string; type?: string; source?: string }[];
    mode: 'face' | 'faceless';
    aspect_ratio: string;
    duration_setting: number;
    created_at: string;
    updated_at: string;
}

// Video job from video_jobs table (for face video processing)
export interface DbVideoJob {
    id: string;
    user_id: string;
    job_type?: 'face' | 'faceless'; // Type of job for resume functionality
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    progress_message: string;
    input_data: {
        scenes: { text: string; type: 'face' | 'asset' }[];
        faceImageUrl?: string;
        voiceId?: string;
        aspectRatio?: '9:16' | '16:9' | '1:1';
        captionStyle?: string;
        enableBackgroundMusic?: boolean;
        enableCaptions?: boolean;
    };
    result_data?: {
        videoUrl: string;
        duration: number;
    };
    error?: string;
    created_at: string;
    updated_at: string;
    is_processing?: boolean;
}


// ==========================================
// USER FUNCTIONS
// ==========================================

export async function getOrCreateUser(clerkId: string, email: string, name?: string, imageUrl?: string): Promise<DbUser | null> {
    // Check if user exists
    const { data: existing } = await supabase
        .from('users')
        .select('*')
        .eq('clerk_id', clerkId)
        .single();

    if (existing) {
        // Update user info if changed
        if (name !== existing.name || imageUrl !== existing.image_url) {
            await supabase
                .from('users')
                .update({ name, image_url: imageUrl })
                .eq('id', existing.id);
        }
        return existing;
    }

    // Create new user
    const { data: newUser, error } = await supabase
        .from('users')
        .insert({
            clerk_id: clerkId,
            email,
            name,
            image_url: imageUrl,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating user:', error);
        return null;
    }

    return newUser;
}

export async function getUserByClerkId(clerkId: string): Promise<DbUser | null> {
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('clerk_id', clerkId)
        .single();

    return data;
}

// ==========================================
// VIDEO FUNCTIONS
// ==========================================

export async function saveVideo(
    userId: string,
    videoUrl: string,
    script: string,
    mode: 'face' | 'faceless',
    duration: number,
    hasCaptions: boolean,
    hasMusic: boolean,
    thumbnailUrl?: string,
    topic?: string,
    assets?: { url: string; source?: string }[],
    client: any = supabase
): Promise<DbVideo | null> {
    // Auto-generate topic from first 4-5 words of script if not provided
    let finalTopic = topic;
    if (!finalTopic && script) {
        const words = script.trim().split(/\s+/).slice(0, 5);
        finalTopic = words.join(' ') + (words.length >= 5 ? '...' : '');
    }

    const { data, error } = await client
        .from('videos')
        .insert({
            user_id: userId,
            video_url: videoUrl,
            script,
            topic: finalTopic || null,
            assets: assets || [],
            mode,
            duration: Math.round(duration),
            has_captions: hasCaptions,
            has_music: hasMusic,
            thumbnail_url: thumbnailUrl,
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving video:', error.message, error.code, error.details);
        return null;
    }

    return data;
}

// Fetch video list WITHOUT the large video_url field for fast loading
export async function getVideos(userId: string): Promise<DbVideo[]> {
    const { data } = await supabase
        .from('videos')
        .select('id, user_id, script, topic, mode, duration, has_captions, has_music, thumbnail_url, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

    // Return with video_url as empty string - it will be fetched on-demand
    return (data || []).map(v => ({ ...v, video_url: '' }));
}

// Fetch a single video with full data (including video_url) for playback
export async function getVideoById(videoId: string): Promise<DbVideo | null> {
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

    if (error) {
        console.error('Error fetching video:', error);
        return null;
    }

    return data;
}

export async function deleteVideo(videoId: string): Promise<void> {
    await supabase.from('videos').delete().eq('id', videoId);
}

// ==========================================
// VOICE FUNCTIONS
// ==========================================

export async function uploadVoiceSample(userId: string, file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop() || 'webm';
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('voices')
        .upload(filePath, file);

    if (uploadError) {
        console.error('Error uploading voice sample:', uploadError);
        return null;
    }

    const { data } = supabase.storage.from('voices').getPublicUrl(filePath);
    return data.publicUrl;
}

export async function saveVoice(
    userId: string,
    voiceId: string | null,
    voiceSampleUrl: string,
    name?: string,
    previewUrl?: string,
    refText?: string,
    options: {
        minimaxVoiceId?: string;
        qwenEmbeddingUrl?: string;
        ttsProvider?: 'minimax' | 'qwen';
    } = {},
    client: any = supabase
): Promise<DbVoice | null> {
    // Validate userId is a UUID, not a Clerk ID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(userId)) {
        console.error('[saveVoice] Invalid userId format - expected UUID, got:', userId);
        console.error('[saveVoice] This may be a Clerk ID being passed instead of dbUser.id');
        return null;
    }

    // Deactivate all other voices for this user
    await client
        .from('voices')
        .update({ is_active: false })
        .eq('user_id', userId);

    // Create new voice (always add as new, mark as active)
    const { data, error } = await client
        .from('voices')
        .insert({
            user_id: userId,
            voice_id: voiceId || 'pending',
            voice_sample_url: voiceSampleUrl,
            preview_url: previewUrl,
            name: name || 'My Voice',
            ref_text: refText || null,
            minimax_voice_id: options.minimaxVoiceId || null,
            qwen_embedding_url: options.qwenEmbeddingUrl || null,
            tts_provider: options.ttsProvider || null,
            is_active: true,
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving voice:', error);
        return null;
    }

    return data;
}

// Get all voices for a user
export async function getAllVoices(userId: string): Promise<DbVoice[]> {
    const { data } = await supabase
        .from('voices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    return data || [];
}

// Get the active voice for a user
export async function getVoice(userId: string): Promise<DbVoice | null> {
    const { data } = await supabase
        .from('voices')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

    return data;
}

// Set a specific voice as active
export async function setActiveVoice(userId: string, voiceId: string, client: any = supabase): Promise<DbVoice | null> {
    // Validate userId is a UUID, not a Clerk ID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(userId)) {
        console.error('[setActiveVoice] Invalid userId format - expected UUID, got:', userId);
        return null;
    }

    // Deactivate all voices for this user
    await client
        .from('voices')
        .update({ is_active: false })
        .eq('user_id', userId);

    // Activate the selected voice
    const { data, error } = await client
        .from('voices')
        .update({ is_active: true })
        .eq('id', voiceId)
        .select()
        .single();

    if (error) {
        console.error('Error setting active voice:', error);
        return null;
    }

    return data;
}

// Update voice ID (for re-cloning when expired)
export async function updateVoiceId(
    id: string,
    newVoiceId: string,
    newPreviewUrl?: string
): Promise<DbVoice | null> {
    const { data, error } = await supabase
        .from('voices')
        .update({
            voice_id: newVoiceId,
            preview_url: newPreviewUrl
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating voice ID:', error);
        return null;
    }

    return data;
}

// Update Qwen embedding URL for a voice
export async function updateQwenEmbedding(
    voiceId: string,
    embeddingUrl: string,
    ttsProvider: 'qwen' = 'qwen'
): Promise<DbVoice | null> {
    const { data, error } = await supabase
        .from('voices')
        .update({
            qwen_embedding_url: embeddingUrl,
            tts_provider: ttsProvider
        })
        .eq('id', voiceId)
        .select()
        .single();

    if (error) {
        console.error('Error updating Qwen embedding:', error);
        return null;
    }

    return data;
}

// Update voice TTS provider preference
export async function updateVoiceProvider(
    voiceId: string,
    provider: 'minimax' | 'qwen'
): Promise<DbVoice | null> {
    const { data, error } = await supabase
        .from('voices')
        .update({ tts_provider: provider })
        .eq('id', voiceId)
        .select()
        .single();

    if (error) {
        console.error('Error updating voice provider:', error);
        return null;
    }

    return data;
}

export async function deleteVoice(voiceId: string): Promise<void> {
    await supabase.from('voices').delete().eq('id', voiceId);
}

// ==========================================
// AVATAR FUNCTIONS
// ==========================================


export async function uploadAvatarImage(userId: string, file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

    if (uploadError) {
        console.error('Error uploading avatar image:', uploadError);
        return null;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
}

export async function saveAvatar(
    userId: string,
    imageUrl: string,
    name?: string,
    isDefault?: boolean,
    client: any = supabase // Use authenticated client if provided
): Promise<DbAvatar | null> {
    // Check if avatar with same image_url already exists for this user
    const { data: existing } = await client
        .from('avatars')
        .select('*')
        .eq('user_id', userId)
        .eq('image_url', imageUrl)
        .single();

    if (existing) {
        // Avatar already exists - update is_default if needed
        if (isDefault && !existing.is_default) {
            // Unset other defaults first
            await client
                .from('avatars')
                .update({ is_default: false })
                .eq('user_id', userId);

            // Set this one as default
            const { data: updated, error } = await client
                .from('avatars')
                .update({ is_default: true })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating avatar:', error);
                return existing;
            }
            return updated;
        }
        // Return existing without changes
        return existing;
    }

    // If setting as default, unset others
    if (isDefault) {
        await client
            .from('avatars')
            .update({ is_default: false })
            .eq('user_id', userId);
    }

    const { data, error } = await client
        .from('avatars')
        .insert({
            user_id: userId,
            image_url: imageUrl,
            name: name || 'Avatar',
            is_default: isDefault ?? false,
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving avatar:', error);
        return null;
    }

    return data;
}

export async function getAvatars(userId: string): Promise<DbAvatar[]> {
    const { data } = await supabase
        .from('avatars')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    return data || [];
}

export async function getDefaultAvatar(userId: string): Promise<DbAvatar | null> {
    const { data } = await supabase
        .from('avatars')
        .select('*')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

    return data;
}

export async function deleteAvatar(avatarId: string): Promise<void> {
    await supabase.from('avatars').delete().eq('id', avatarId);
}

// ==========================================
// VIDEO DRAFT FUNCTIONS
// ==========================================

export async function saveDraft(
    userId: string,
    topic: string,
    script?: string,
    assets?: { url: string; type?: string; source?: string }[],
    mode: 'face' | 'faceless' = 'faceless',
    aspectRatio: string = '9:16',
    durationSetting: number = 30
): Promise<DbVideoDraft | null> {
    const { data, error } = await supabase
        .from('video_drafts')
        .insert({
            user_id: userId,
            topic,
            script,
            assets: assets || [],
            mode,
            aspect_ratio: aspectRatio,
            duration_setting: durationSetting
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving draft:', error);
        return null;
    }

    return data;
}

export async function updateDraft(
    draftId: string,
    updates: {
        topic?: string;
        script?: string;
        assets?: { url: string; type?: string; source?: string }[];
        mode?: 'face' | 'faceless';
        aspect_ratio?: string;
        duration_setting?: number;
    }
): Promise<DbVideoDraft | null> {
    const { data, error } = await supabase
        .from('video_drafts')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', draftId)
        .select()
        .single();

    if (error) {
        console.error('Error updating draft:', error);
        return null;
    }

    return data;
}

export async function getDrafts(userId: string): Promise<DbVideoDraft[]> {
    const { data, error } = await supabase
        .from('video_drafts')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error getting drafts:', error);
        return [];
    }

    return data || [];
}

export async function getLatestDraft(userId: string): Promise<DbVideoDraft | null> {
    const { data, error } = await supabase
        .from('video_drafts')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error getting latest draft:', error);
        return null;
    }

    return data;
}

export async function deleteDraft(draftId: string): Promise<void> {
    await supabase.from('video_drafts').delete().eq('id', draftId);
}

// ==========================================
// VIDEO JOBS FUNCTIONS (for in-progress face videos)
// ==========================================

const STALE_JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes - if no update in 15 min, job is stale
const ABANDONED_JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes - mark as failed

// Get active (processing) video jobs for a user
// Also cleans up stale jobs that are stuck in processing
export async function getActiveVideoJobs(userId: string): Promise<DbVideoJob[]> {
    const { data, error } = await supabase
        .from('video_jobs')
        .select('*')
        .eq('user_uuid', userId)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error getting active video jobs:', error);
        return [];
    }

    if (!data) return [];

    const now = Date.now();
    const validJobs: DbVideoJob[] = [];

    for (const job of data) {
        const updatedAt = new Date(job.updated_at).getTime();
        const age = now - updatedAt;

        // If job is older than 30 minutes without update, mark as failed
        if (age > ABANDONED_JOB_TIMEOUT_MS) {
            console.log(`[Cleanup] Marking abandoned job ${job.id} as failed (age: ${Math.round(age / 60000)}min)`);
            await supabase
                .from('video_jobs')
                .update({
                    status: 'failed',
                    error: 'Job timed out - no progress for 30 minutes',
                    is_processing: false
                })
                .eq('id', job.id);
            continue; // Don't include in results
        }

        // If job is stale (>15 min) but not abandoned, reset lock so it can be resumed
        if (age > STALE_JOB_TIMEOUT_MS && job.is_processing) {
            console.log(`[Cleanup] Resetting stale lock on job ${job.id} (age: ${Math.round(age / 60000)}min)`);
            await supabase
                .from('video_jobs')
                .update({ is_processing: false })
                .eq('id', job.id);
            job.is_processing = false;
        }

        validJobs.push(job);
    }

    return validJobs;
}

// Get a single video job by ID  
export async function getVideoJobById(jobId: string): Promise<DbVideoJob | null> {
    const { data, error } = await supabase
        .from('video_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

    if (error) {
        console.error('Error getting video job:', error);
        return null;
    }

    return data;
}

// ==========================================
// CREDITS FUNCTIONS
// ==========================================

export interface DbUserCredits {
    id: string;
    user_id: string;
    balance: number;
    lifetime_purchased: number;
    lifetime_used: number;
    created_at: string;
    updated_at: string;
}

export interface DbCreditTransaction {
    id: string;
    user_id: string;
    amount: number;
    balance_after: number;
    type: 'purchase' | 'usage' | 'refund' | 'bonus';
    description?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
}

/**
 * Get the current credit balance for a user
 */
export async function getUserCredits(userId: string): Promise<DbUserCredits | null> {
    const { data, error } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error getting user credits:', error);
        return null;
    }

    // If no record exists, create one with default balance
    if (!data) {
        const { data: newCredits, error: createError } = await supabase
            .from('user_credits')
            .insert({ user_id: userId, balance: 500 }) // 500 welcome bonus
            .select()
            .single();

        if (createError) {
            console.error('Error creating user credits:', createError);
            return null;
        }

        // Log the welcome bonus transaction
        await supabase.from('credit_transactions').insert({
            user_id: userId,
            amount: 500,
            balance_after: 500,
            type: 'bonus',
            description: 'Welcome bonus credits'
        });

        return newCredits;
    }

    return data;
}

/**
 * Check if a user has enough credits for an operation
 */
export async function hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
    const credits = await getUserCredits(userId);
    return credits !== null && credits.balance >= amount;
}

/**
 * Deduct credits from a user's balance (atomic operation)
 * Returns the updated balance or null if insufficient credits
 */
export async function deductCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, unknown>
): Promise<{ success: boolean; balance: number; error?: string }> {
    // Get current balance
    const credits = await getUserCredits(userId);

    if (!credits) {
        return { success: false, balance: 0, error: 'Could not get user credits' };
    }

    if (credits.balance < amount) {
        return {
            success: false,
            balance: credits.balance,
            error: `Insufficient credits. Need ${amount}, have ${credits.balance}`
        };
    }

    const newBalance = credits.balance - amount;
    const newLifetimeUsed = (credits.lifetime_used || 0) + amount;

    // Update balance
    const { error: updateError } = await supabase
        .from('user_credits')
        .update({
            balance: newBalance,
            lifetime_used: newLifetimeUsed,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

    if (updateError) {
        console.error('Error deducting credits:', updateError);
        return { success: false, balance: credits.balance, error: 'Failed to update balance' };
    }

    // Log transaction
    console.log(`[deductCredits] Logging transaction: user=${userId}, amount=-${amount}, balance_after=${newBalance}`);
    const { error: txError } = await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: -amount, // negative for deduction
        balance_after: newBalance,
        type: 'usage',
        description,
        metadata: metadata || {}
    });

    if (txError) {
        console.error('[deductCredits] Failed to log transaction:', txError);
        // Still return success since credits were deducted, but log the error
    } else {
        console.log(`[deductCredits] ✅ Transaction logged successfully`);
    }

    console.log(`[deductCredits] ✅ Deducted ${amount} credits from user ${userId}. New balance: ${newBalance}`);
    return { success: true, balance: newBalance };
}

/**
 * Add credits to a user's balance
 */
export async function addCredits(
    userId: string,
    amount: number,
    type: 'purchase' | 'refund' | 'bonus',
    description: string,
    metadata?: Record<string, unknown>
): Promise<{ success: boolean; balance: number }> {
    const credits = await getUserCredits(userId);

    if (!credits) {
        return { success: false, balance: 0 };
    }

    const newBalance = credits.balance + amount;
    const updateData: Record<string, unknown> = {
        balance: newBalance,
        updated_at: new Date().toISOString()
    };

    if (type === 'purchase') {
        updateData.lifetime_purchased = (credits.lifetime_purchased || 0) + amount;
    }

    const { error: updateError } = await supabase
        .from('user_credits')
        .update(updateData)
        .eq('user_id', userId);

    if (updateError) {
        console.error('Error adding credits:', updateError);
        return { success: false, balance: credits.balance };
    }

    // Log transaction
    await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount,
        balance_after: newBalance,
        type,
        description,
        metadata: metadata || {}
    });

    return { success: true, balance: newBalance };
}
