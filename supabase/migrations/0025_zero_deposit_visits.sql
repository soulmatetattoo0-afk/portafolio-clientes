-- A booking may ask for no deposit (already paid outside, a friend, a test run).
alter table public.quotes drop constraint if exists quotes_deposit_cents_check;
alter table public.quotes add constraint quotes_deposit_cents_check check (deposit_cents >= 0);

-- The artists a signed-in client has looked at: "Mis artistas" remembers them.
create table if not exists public.artist_visits (
  user_id uuid not null,
  artist_id uuid not null references public.artists (id) on delete cascade,
  visits integer not null default 1,
  last_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);
create index if not exists artist_visits_user on public.artist_visits (user_id, last_at desc);
alter table public.artist_visits enable row level security;
