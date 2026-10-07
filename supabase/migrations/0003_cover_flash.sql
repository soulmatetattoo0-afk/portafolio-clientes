-- The public artist experience: a poster cover (photo, giant word, accent)
-- and "flash" designs the artist has drawn and wants to tattoo.

alter table public.artists
  add column if not exists cover_word text check (char_length(cover_word) <= 24),
  add column if not exists accent text check (accent ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists cover_quote text check (char_length(cover_quote) <= 160),
  add column if not exists since_year integer check (since_year between 1950 and 2100);

create table if not exists public.flash_designs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  image_path text,
  title text not null default '',
  description text,
  size_label text,
  price_cents integer check (price_cents >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  status text not null default 'available' check (status in ('available', 'reserved', 'taken')),
  repeatable boolean not null default false,
  sort integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists flash_artist_idx on public.flash_designs (artist_id, sort);

alter table public.flash_designs enable row level security;
create policy flash_designs_member_all on public.flash_designs for all to authenticated
  using (private.is_member(studio_id)) with check (private.is_member(studio_id));
revoke all on public.flash_designs from anon;

-- A brief may start from a flash design.
alter table public.briefs add column if not exists flash_id uuid references public.flash_designs (id) on delete set null;
