-- A studio with several artists gets a front of its own: its magazine (the
-- house, then each artist with their work), booking with the artist of your
-- choice, and a door for artists who want to join as guests or residents.
-- Every front (artist or studio) keeps the layout its owner arranged.

alter table public.studios add column if not exists about text check (char_length(about) <= 3000);
alter table public.studios add column if not exists city text;
alter table public.studios add column if not exists cover_path text;
alter table public.studios add column if not exists accent text check (accent is null or accent ~ '^#[0-9a-fA-F]{6}$');
alter table public.studios add column if not exists since_year integer;
alter table public.studios add column if not exists layout jsonb;
alter table public.artists add column if not exists layout jsonb;

create table if not exists public.studio_applications (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  years integer not null check (years between 0 and 60),
  role text not null check (role in ('guest', 'resident')),
  styles text[] not null default '{}',
  message text check (char_length(message) <= 2000),
  links text[] not null default '{}',
  files text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'seen', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
create index if not exists studio_applications_studio_idx on public.studio_applications (studio_id, created_at desc);
alter table public.studio_applications enable row level security;
