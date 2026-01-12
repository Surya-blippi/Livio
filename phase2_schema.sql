-- =========================================================================
-- PHASE 2: DATA PERSISTENCE SCHEMA
-- Purpose: Professional management of User Projects (Drafts) and Assets
-- =========================================================================

-- 1. ENUMS (for cleaner data)
CREATE TYPE project_status AS ENUM ('draft', 'processing', 'completed', 'failed');
CREATE TYPE asset_type AS ENUM ('image', 'video', 'audio');

-- 2. PROJECTS TABLE (Replaces simple "video_drafts")
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Untitled Project',
    
    -- Core Content
    topic TEXT,
    script TEXT,
    
    -- Configuration (Jsonb allows flexibility as we add features)
    settings JSONB NOT NULL DEFAULT '{}'::jsonb, 
    -- Example: { "mode": "faceless", "aspectRatio": "9:16", "voiceId": "..." }

    status project_status DEFAULT 'draft',
    current_step INTEGER DEFAULT 0, -- 0=Script, 1=Assets, 2=Preview...
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ASSETS TABLE (The "Digital Asset Manager")
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- Optional: Link to a specific project
    
    type asset_type NOT NULL,
    storage_path TEXT NOT NULL, -- Path in Supabase Storage bucket
    public_url TEXT NOT NULL,   -- The usable URL
    
    -- Tracking origin (for "Link Rot" prevention validation)
    source_url TEXT,            -- Where we found it (e.g., Unsplash URL)
    source_name TEXT,           -- e.g., "Unsplash", "User Upload"
    
    metadata JSONB DEFAULT '{}'::jsonb, -- { "width": 1024, "height": 1024, "alt": "..." }
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. LINKING TABLE (Projects <-> Assets)
-- Many-to-Many: One project has many assets, One asset can be in many projects
CREATE TABLE IF NOT EXISTS project_assets (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    "order" INTEGER NOT NULL DEFAULT 0, -- Sort order in the timeline
    PRIMARY KEY (project_id, asset_id)
);

-- 5. RLS POLICIES (Secure by Default)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assets ENABLE ROW LEVEL SECURITY;

-- Projects Policies
CREATE POLICY "Users own projects" ON projects 
    FOR ALL USING (auth.uid() = user_id);

-- Assets Policies
CREATE POLICY "Users own assets" ON assets 
    FOR ALL USING (auth.uid() = user_id);

-- Project Assets Policies (Implicit via Project ownership)
CREATE POLICY "Users manage project assets" ON project_assets 
    FOR ALL USING (
        EXISTS (SELECT 1 FROM projects WHERE id = project_assets.project_id AND user_id = auth.uid())
    );
