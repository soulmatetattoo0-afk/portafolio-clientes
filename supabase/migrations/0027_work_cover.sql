-- The picture behind the Obras door on the artist's page: one the artist picks
-- (a wide photo, or one of their pieces). Null: the first piece of their work.
alter table public.artists add column if not exists work_cover_path text;
