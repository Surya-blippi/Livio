create table public.videos (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  video_url text not null,
  script text not null,
  mode text not null,
  duration integer not null,
  has_captions boolean null default false,
  has_music boolean null default false,
  thumbnail_url text null,
  created_at timestamp with time zone null default now(),
  topic text null,
  assets jsonb null default '[]'::jsonb,
  constraint videos_pkey primary key (id),
  constraint videos_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE,
  constraint videos_mode_check check (
    (
      mode = any (array['face'::text, 'faceless'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_videos_user_id on public.videos using btree (user_id) TABLESPACE pg_default;
