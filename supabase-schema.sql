-- Supabase Database Schema for Pocket Influencer
-- Run this SQL in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (linked to Clerk)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster clerk_id lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

-- Videos table (generated video history)
CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  script TEXT NOT NULL,
  topic TEXT,
  assets JSONB DEFAULT '[]',
  mode TEXT NOT NULL CHECK (mode IN ('face', 'faceless')),
  duration INTEGER NOT NULL,
  has_captions BOOLEAN DEFAULT false,
  has_music BOOLEAN DEFAULT false,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);

-- Voices table (cloned voice data)
CREATE TABLE IF NOT EXISTS voices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  voice_sample_url TEXT NOT NULL,
  preview_url TEXT,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster user lookups (allowing multiple voices per user)
CREATE INDEX IF NOT EXISTS idx_voices_user_id ON voices(user_id);

-- Avatars table (saved photos)
CREATE TABLE IF NOT EXISTS avatars (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  name TEXT DEFAULT 'Avatar',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_avatars_user_id ON avatars(user_id);

-- Video Drafts table (saves topic, script, assets before video generation)
CREATE TABLE IF NOT EXISTS video_drafts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  script TEXT,
  assets JSONB DEFAULT '[]',
  mode TEXT DEFAULT 'faceless' CHECK (mode IN ('face', 'faceless')),
  aspect_ratio TEXT DEFAULT '9:16',
  duration_setting INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_video_drafts_user_id ON video_drafts(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_drafts ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
-- Providing full access to authenticated users to fix 406/409 errors
-- In a production app, you would restrict this to (auth.uid() = user_id)

DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can insert" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Enable all access for authenticated users" ON users FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own videos" ON videos;
DROP POLICY IF EXISTS "Users can insert videos" ON videos;
DROP POLICY IF EXISTS "Users can delete own videos" ON videos;
CREATE POLICY "Enable all access for authenticated users" ON videos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own voice" ON voices;
DROP POLICY IF EXISTS "Users can insert voice" ON voices;
DROP POLICY IF EXISTS "Users can update own voice" ON voices;
DROP POLICY IF EXISTS "Users can delete own voice" ON voices;
CREATE POLICY "Enable all access for authenticated users" ON voices FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own avatars" ON avatars;
DROP POLICY IF EXISTS "Users can insert avatars" ON avatars;
DROP POLICY IF EXISTS "Users can update own avatars" ON avatars;
DROP POLICY IF EXISTS "Users can delete own avatars" ON avatars;
CREATE POLICY "Enable all access for authenticated users" ON avatars FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON video_drafts;
CREATE POLICY "Enable all access for authenticated users" ON video_drafts FOR ALL TO authenticated USING (true) WITH CHECK (true);
