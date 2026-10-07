-- Some artists bring a finished poster as their cover (type already on the photo):
-- the cover then shows the photo whole and writes nothing over it.
alter table public.artists add column if not exists cover_poster boolean not null default false;
