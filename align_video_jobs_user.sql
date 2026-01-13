-- =========================================================================
-- MIGRATION: Align video_jobs with proper User Reference
-- Run this in Supabase SQL Editor
-- =========================================================================

-- Step 1: Add new UUID column for user reference
ALTER TABLE video_jobs 
ADD COLUMN IF NOT EXISTS user_uuid UUID;

-- Step 2: Populate user_uuid from existing user_id (TEXT) via clerk_id lookup
-- This maps the clerk_id stored in user_id to the actual users.id UUID
UPDATE video_jobs vj
SET user_uuid = u.id
FROM users u
WHERE vj.user_id = u.id::text OR vj.user_id = u.clerk_id;

-- Step 3: Add job_type column if not exists (from previous migration)
ALTER TABLE video_jobs 
ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'faceless' 
CHECK (job_type IN ('face', 'faceless'));

-- Step 4: After verifying data migration, you can optionally:
-- - Drop the old user_id TEXT column
-- - Rename user_uuid to user_id
-- - Add foreign key constraint

-- For now, let's keep both columns for backward compatibility
-- and add the foreign key to the new column

-- Add foreign key constraint (optional - only run after verifying data)
-- ALTER TABLE video_jobs 
-- ADD CONSTRAINT fk_video_jobs_user 
-- FOREIGN KEY (user_uuid) REFERENCES users(id) ON DELETE CASCADE;

-- =========================================================================
-- UPDATE RLS POLICY for video_jobs to use new column
-- =========================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users own jobs" ON video_jobs;
DROP POLICY IF EXISTS "Worker Full Access" ON video_jobs;
DROP POLICY IF EXISTS "Public Access Video Jobs" ON video_jobs;

-- Create new policy that works with both old and new column
CREATE POLICY "Users own jobs" ON video_jobs
    FOR ALL
    TO authenticated
    USING (
        auth.uid() = user_uuid OR 
        auth.uid()::text = user_id
    )
    WITH CHECK (
        auth.uid() = user_uuid OR 
        auth.uid()::text = user_id
    );

-- Service Role (The Worker) needs full access to update status
CREATE POLICY "Worker Full Access" ON video_jobs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =========================================================================
-- VERIFY MIGRATION
-- =========================================================================

-- Check the new column exists and has data
SELECT 
    id, 
    user_id AS old_user_id_text,
    user_uuid AS new_user_uuid,
    job_type,
    status,
    created_at
FROM video_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Check schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'video_jobs'
ORDER BY ordinal_position;
