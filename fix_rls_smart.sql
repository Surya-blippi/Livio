-- FIX RLS POLICY: Smart Lookup (Run this in Supabase SQL Editor)
-- Purpose: Allow users to create jobs for their own Internal UUID.
-- How: Look up the user by UUID in 'users' table and check if their 'clerk_id' matches the logged-in 'auth.uid()'.

-- Drop previous policies
DROP POLICY IF EXISTS "Users own jobs" ON video_jobs;

-- Create SMART policy
CREATE POLICY "Users own jobs" ON video_jobs
    FOR ALL
    TO authenticated
    USING (
        -- Check if the job belongs to a user owned by the current auth token
        exists (
            select 1 from users
            where users.id = video_jobs.user_uuid
            and users.clerk_id = auth.uid()::text
        )
    )
    WITH CHECK (
        -- Check if the job belongs to a user owned by the current auth token
        exists (
            select 1 from users
            where users.id = video_jobs.user_uuid
            and users.clerk_id = auth.uid()::text
        )
    );

-- Also ensure 'users' table is readable for this check (should be already, but ensuring)
-- CREATE POLICY "Users can read own data" ... (Already exists)
