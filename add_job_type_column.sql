-- Add job_type column to video_jobs table
-- Run this in the Supabase SQL Editor

-- Add the job_type column
ALTER TABLE video_jobs 
ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'faceless' 
CHECK (job_type IN ('face', 'faceless'));

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'video_jobs' AND column_name = 'job_type';
