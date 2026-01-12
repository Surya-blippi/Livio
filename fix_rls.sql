-- =========================================================================
-- FIXED RLS POLICIES (Version 4 - The "Robust" Text-Cast Strategy)
-- Reason: We have a mix of UUID and TEXT columns across tables.
-- Solution: Cast EVERYTHING to ::text for comparisons. This never fails.
-- =========================================================================

-- 1. USERS TABLE
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data" ON users
    FOR SELECT
    USING (clerk_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE
    USING (clerk_id = (auth.jwt() ->> 'sub'));

-- 2. VIDEOS TABLE
DROP POLICY IF EXISTS "Users own videos" ON videos;
CREATE POLICY "Users own videos" ON videos
    FOR ALL
    USING (
        user_id::text IN (SELECT id::text FROM users WHERE clerk_id = (auth.jwt() ->> 'sub'))
    )
    WITH CHECK (
        user_id::text IN (SELECT id::text FROM users WHERE clerk_id = (auth.jwt() ->> 'sub'))
    );

-- 3. VIDEO JOBS (Likely the culprit for current error)
DROP POLICY IF EXISTS "Users own jobs" ON video_jobs;
CREATE POLICY "Users own jobs" ON video_jobs
    FOR ALL
    TO authenticated
    USING (
        user_id::text IN (SELECT id::text FROM users WHERE clerk_id = (auth.jwt() ->> 'sub'))
    )
    WITH CHECK (
        user_id::text IN (SELECT id::text FROM users WHERE clerk_id = (auth.jwt() ->> 'sub'))
    );

-- 4. VOICES
DROP POLICY IF EXISTS "Users own voices" ON voices;
CREATE POLICY "Users own voices" ON voices
    FOR ALL
    USING (
        user_id::text IN (SELECT id::text FROM users WHERE clerk_id = (auth.jwt() ->> 'sub'))
    );

-- 5. ASSETS
DROP POLICY IF EXISTS "Users own assets" ON assets;
CREATE POLICY "Users own assets" ON assets 
    FOR ALL USING (
        user_id::text IN (SELECT id::text FROM users WHERE clerk_id = (auth.jwt() ->> 'sub'))
    );

-- 6. PROJECTS
DROP POLICY IF EXISTS "Users own projects" ON projects;
CREATE POLICY "Users own projects" ON projects 
    FOR ALL USING (
        user_id::text IN (SELECT id::text FROM users WHERE clerk_id = (auth.jwt() ->> 'sub'))
    );
