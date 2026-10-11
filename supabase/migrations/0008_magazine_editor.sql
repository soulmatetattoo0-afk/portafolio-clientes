-- The artist lays out their own magazine: a cover and pages of frames and text
-- (see src/lib/magazine.ts for the shape). Null until the artist opens the editor.
alter table public.artists add column if not exists magazine jsonb;

-- Frames in the magazine can hold short videos as well as photographs.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    update storage.buckets
       set file_size_limit = 62914560,
           allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
     where id = 'portfolio';
    update storage.buckets
       set file_size_limit = 62914560,
           allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime']
     where id = 'brief-files';
  end if;
end $$;
