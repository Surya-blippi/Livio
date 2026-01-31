-- Manually fix stuck job c99349ad-eb6a-41b7-b2ab-617534c57a6b
-- Project ID pUBhSJGI1iVWuw8l completed successfully.

-- 1. Update video_jobs table
UPDATE "public"."video_jobs"
SET 
  status = 'completed',
  progress = 100,
  progress_message = 'Video ready! (Manual Fix)',
  result_data = jsonb_build_object(
    'videoUrl', 'https://assets.json2video.com/projects/pUBhSJGI1iVWuw8l/movie.mp4',
    'duration', 30.4,
    'clipAssets', (
      SELECT jsonb_agg(jsonb_build_object('url', elem->>'clipUrl', 'source', 'wavespeed'))
      FROM jsonb_array_elements(processed_scenes) elem
      WHERE elem->>'type' = 'face'
    )
  ),
  input_data = input_data - 'pendingRender',
  is_processing = false,
  updated_at = NOW()
WHERE id = 'c99349ad-eb6a-41b7-b2ab-617534c57a6b';

-- 2. Insert into videos table (if not exists)
INSERT INTO "public"."videos" (
  user_id,
  video_url,
  script,
  mode,
  topic,
  duration,
  has_captions,
  has_music,
  assets,
  thumbnail_url
)
SELECT 
  user_id,
  'https://assets.json2video.com/projects/pUBhSJGI1iVWuw8l/movie.mp4',
  (
    SELECT string_agg(elem->>'text', E'\n\n')
    FROM jsonb_array_elements(processed_scenes) elem
  ),
  'face',
  -- Generate topic (approx)
  (
    SELECT substring(string_agg(elem->>'text', ' '), 1, 50) || '...'
    FROM jsonb_array_elements(processed_scenes) elem
  ),
  30, -- Duration
  (input_data->>'enableCaptions')::boolean,
  (input_data->>'enableBackgroundMusic')::boolean,
  (
      SELECT jsonb_agg(jsonb_build_object('url', elem->>'clipUrl', 'source', 'wavespeed'))
      FROM jsonb_array_elements(processed_scenes) elem
      WHERE elem->>'type' = 'face'
  ),
  -- Thumbnail (first face clip)
  (
      SELECT elem->>'clipUrl'
      FROM jsonb_array_elements(processed_scenes) elem
      WHERE elem->>'type' = 'face'
      LIMIT 1
  )
FROM "public"."video_jobs"
WHERE id = 'c99349ad-eb6a-41b7-b2ab-617534c57a6b'
AND NOT EXISTS (
    SELECT 1 FROM "public"."videos" WHERE video_url = 'https://assets.json2video.com/projects/pUBhSJGI1iVWuw8l/movie.mp4'
);
