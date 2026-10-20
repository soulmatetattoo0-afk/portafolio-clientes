-- The work, in sections the artist names ("Realismo", "Cover-ups", "Flash
-- 2026"…), and the moment an artist's page goes public: a new page is built
-- privately and launched with one button once it is complete.

create table if not exists public.portfolio_sections (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_sections_artist_idx on public.portfolio_sections (artist_id, sort);
alter table public.portfolio_sections enable row level security;

alter table public.portfolio_items add column if not exists section_id uuid references public.portfolio_sections (id) on delete set null;

alter table public.artists add column if not exists launched_at timestamptz;
-- Pages that were already public stay public.
update public.artists set launched_at = coalesce(launched_at, created_at) where launched_at is null;
