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
