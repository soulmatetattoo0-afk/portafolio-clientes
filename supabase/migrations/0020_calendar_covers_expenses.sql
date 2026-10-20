-- Each city's calendar wears a cover the artist picks (a photo of the city, a piece, their face).
alter table public.tour_stops add column if not exists cover_path text;

-- Caja: what the artist spends, next to what the app collects for them.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  day date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists expenses_artist_day_idx on public.expenses (artist_id, day desc);

alter table public.expenses enable row level security;
drop policy if exists "expenses members" on public.expenses;
create policy "expenses members" on public.expenses
  for all using (private.is_member(studio_id)) with check (private.is_member(studio_id));
