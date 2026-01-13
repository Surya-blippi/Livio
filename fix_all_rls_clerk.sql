-- MASTER FIX FOR RLS POLICIES (Run this in Supabase SQL Editor)
-- PROBLEM: auth.uid() is text (Clerk ID), database IDs are UUIDs. 
-- Comparing them directly (auth.uid() = id) causes Postgres to crash/fail with 400 Error.

-- 1. Fix USERS table policy (The Foundation)
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

CREATE POLICY "Users can read own data" ON users
    FOR SELECT
    USING (auth.uid()::text = clerk_id); -- Compare Text to Text!

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE
    USING (auth.uid()::text = clerk_id);


-- 2. Fix VIDEO_JOBS policy (The one failing now)
DROP POLICY IF EXISTS "Users own jobs" ON video_jobs;

CREATE POLICY "Users own jobs" ON video_jobs
    FOR ALL
    TO authenticated
    USING (
        exists (
            select 1 from users
            where users.id = video_jobs.user_uuid
            and users.clerk_id = auth.uid()::text -- Valid lookup
        )
    )
    WITH CHECK (
        exists (
            select 1 from users
            where users.id = video_jobs.user_uuid
            and users.clerk_id = auth.uid()::text -- Valid lookup
        )
    );


-- 3. Fix VIDEOS table policy
DROP POLICY IF EXISTS "Users own videos" ON videos;

CREATE POLICY "Users own videos" ON videos
    FOR ALL
    USING (
        exists (
            select 1 from users
            where users.id = videos.user_id
            and users.clerk_id = auth.uid()::text
        )
    )
    WITH CHECK (
        exists (
            select 1 from users
            where users.id = videos.user_id
            and users.clerk_id = auth.uid()::text
        )
    );


-- 4. Fix VOICES table policy
DROP POLICY IF EXISTS "Users own voices" ON voices;

CREATE POLICY "Users own voices" ON voices
    FOR ALL
    USING (
        exists (
            select 1 from users
            where users.id = voices.user_id
            and users.clerk_id = auth.uid()::text
        )
    );


-- 5. Fix AVATARS table policy
DROP POLICY IF EXISTS "Users own avatars" ON avatars;

CREATE POLICY "Users own avatars" ON avatars
    FOR ALL
    USING (
        exists (
            select 1 from users
            where users.id = avatars.user_id
            and users.clerk_id = auth.uid()::text
        )
    );
