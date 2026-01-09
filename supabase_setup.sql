-- Run this in your Supabase SQL Editor

-- 1. Create the 'voices' bucket (if it doesn't exist)
insert into storage.buckets (id, name, public)
values ('voices', 'voices', true)
on conflict (id) do nothing;

-- 2. Drop existing restrictive policies if they exist (to fix conflicts)
drop policy if exists "Public Access Voices" on storage.objects;
drop policy if exists "Authenticated Upload Voices" on storage.objects;
drop policy if exists "User Update Own Voices" on storage.objects;
drop policy if exists "User Delete Own Voices" on storage.objects;

-- 3. Allow PUBLIC access (Read/Write)
-- Since we are using Clerk for auth and passing the anon key, 
-- we need to allow 'public' role (anon) to interact with this bucket.
-- Security is handled by the application logic (un-guessable filenames, etc.)

create policy "Public Access Voices"
  on storage.objects for select
  using ( bucket_id = 'voices' );

create policy "Public Upload Voices"
  on storage.objects for insert
  to public
  with check ( bucket_id = 'voices' );

create policy "Public Update Voices"
  on storage.objects for update
  to public
  using ( bucket_id = 'voices' );

create policy "Public Delete Voices"
  on storage.objects for delete
  to public
  using ( bucket_id = 'voices' );

-- ============================================
-- VIDEO JOBS TABLE (for queue-based processing)
-- ============================================

-- Create video_jobs table for tracking video generation jobs
CREATE TABLE IF NOT EXISTS video_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    input_data JSONB NOT NULL,
    result_data JSONB,
    error TEXT,
    progress INTEGER DEFAULT 0,
    progress_message TEXT DEFAULT 'Initializing...',
    -- Scene-by-scene processing state
    current_scene_index INTEGER DEFAULT 0,
    processed_scenes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient polling
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_user ON video_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_created ON video_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (using Clerk for auth)
CREATE POLICY "Public Access Video Jobs" ON video_jobs FOR ALL TO public USING (true) WITH CHECK (true);
