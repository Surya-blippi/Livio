-- FIX RLS POLICY (Run this in Supabase SQL Editor)
-- Problem: auth.uid() is a Clerk ID string (e.g., "user_2..."), but user_uuid is a UUID column.
-- Postgres fails when trying to verify "auth.uid() = user_uuid" because the string isn't a valid UUID.

-- Drop the broken policy
DROP POLICY IF EXISTS "Users own jobs" ON video_jobs;

-- Create fixed policy that ONLY compares text to text
-- Since user_id stores the Clerk ID, this is sufficient and safe.
CREATE POLICY "Users own jobs" ON video_jobs
    FOR ALL
    TO authenticated
    USING (
        auth.uid()::text = user_id
    )
    WITH CHECK (
        auth.uid()::text = user_id
    );

-- Verify
SELECT * FROM pg_policies WHERE tablename = 'video_jobs';
