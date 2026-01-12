-- =========================================================================
-- PRODUCTION RLS SETUP (Run this in Supabase SQL Editor)
-- Purpose: Locks down the database so users can ONLY access their own data.
-- =========================================================================

-- 1. Enable RLS on all tables (Safety first)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_drafts ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 2. USERS TABLE POLICIES
-- =========================================================================

-- Allow users to read their own profile
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data" ON users
    FOR SELECT
    USING (auth.uid() = id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE
    USING (auth.uid() = id);

-- Allow Service Role to manage users (for Webhooks/Admin)
DROP POLICY IF EXISTS "Service Role Full Access Users" ON users;
CREATE POLICY "Service Role Full Access Users" ON users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =========================================================================
-- 3. VIDEO JOBS POLICIES (Critical for Job Processing)
-- =========================================================================

-- Users see only their own jobs
DROP POLICY IF EXISTS "Users own jobs" ON video_jobs;
DROP POLICY IF EXISTS "Public Access Video Jobs" ON video_jobs; -- Delete old insecurity
CREATE POLICY "Users own jobs" ON video_jobs
    FOR ALL
    TO authenticated
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- Service Role (The Worker) needs full access to update status
CREATE POLICY "Worker Full Access" ON video_jobs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =========================================================================
-- 4. VIDEOS / ASSETS POLICIES
-- =========================================================================

-- Videos
DROP POLICY IF EXISTS "Users own videos" ON videos;
CREATE POLICY "Users own videos" ON videos
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Voices
DROP POLICY IF EXISTS "Users own voices" ON voices;
CREATE POLICY "Users own voices" ON voices
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Avatars
DROP POLICY IF EXISTS "Users own avatars" ON avatars;
CREATE POLICY "Users own avatars" ON avatars
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
    
-- Drafts
DROP POLICY IF EXISTS "Users own drafts" ON video_drafts;
CREATE POLICY "Users own drafts" ON video_drafts
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

