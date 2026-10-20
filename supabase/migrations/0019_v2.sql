-- The v2 app: a framing for each piece (where the artist centred it and how
-- close, inside the 4:5 window), the artist's pre- and post-care sheets, and a
-- count of visits to each artist's page per day.
alter table public.portfolio_items add column if not exists focus_x numeric not null default 50;
alter table public.portfolio_items add column if not exists focus_y numeric not null default 50;
alter table public.portfolio_items add column if not exists zoom numeric not null default 1;
alter table public.artists add column if not exists precare text;
alter table public.artists add column if not exists postcare text;
create table if not exists public.page_views (
  artist_id uuid not null references public.artists (id) on delete cascade,
  day date not null,
  n integer not null default 0,
  primary key (artist_id, day)
);
alter table public.page_views enable row level security;
