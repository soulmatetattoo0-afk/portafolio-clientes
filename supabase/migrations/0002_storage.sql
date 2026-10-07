-- Storage buckets (Supabase only; skipped on the local embedded database).
-- "portfolio" is public (the artist's work); "brief-files" is private (client
-- body photos and references), read only through short-lived signed URLs
-- created by the server.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('portfolio', 'portfolio', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
      ('brief-files', 'brief-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
    on conflict (id) do nothing;
  end if;
end $$;
