-- The artist's sketchbook in the Sala creativa: short notes, pinned or crossed out.
create table if not exists public.artist_notes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  pinned boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists artist_notes_artist_idx on public.artist_notes (artist_id, pinned desc, created_at desc);

alter table public.artist_notes enable row level security;
drop policy if exists "artist_notes members" on public.artist_notes;
create policy "artist_notes members" on public.artist_notes
  for all using (private.is_member(studio_id)) with check (private.is_member(studio_id));
