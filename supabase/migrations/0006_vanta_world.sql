-- The world outside one artist's page: trades, geography, search, tiers.

-- array_to_string is only STABLE in Postgres, so a generated column cannot
-- call it directly; this wrapper asserts what we know: styles text never
-- depends on session state.
create or replace function public.styles_text(s text[]) returns text
language sql immutable strict as $$ select array_to_string(s, ' ') $$;

alter table public.artists
  add column if not exists trade text not null default 'tattoo' check (trade in ('tattoo', 'barber', 'graffiti')),
  add column if not exists booking_mode text not null default 'brief_quote' check (booking_mode in ('brief_quote', 'slots', 'project')),
  add column if not exists country text,
  add column if not exists city_slug text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists listed boolean not null default true;

alter table public.artists add column if not exists search tsvector generated always as (
  to_tsvector('simple',
    coalesce(display_name, '') || ' ' || coalesce(headline, '') || ' ' || coalesce(home_city, '') || ' ' ||
    coalesce(country, '') || ' ' || public.styles_text(styles))
) stored;
create index if not exists artists_search_idx on public.artists using gin (search);
create index if not exists artists_city_idx on public.artists (city_slug);
create index if not exists artists_trade_idx on public.artists (trade, listed);

alter table public.tour_stops
  add column if not exists city_slug text,
  add column if not exists lat double precision,
  add column if not exists lng double precision;
create index if not exists tour_stops_city_idx on public.tour_stops (city_slug, starts_on);

-- When a piece went public, a recency signal that survives re-ordering.
alter table public.portfolio_items add column if not exists published_at timestamptz not null default now();
create index if not exists portfolio_facets_idx on public.portfolio_items (artist_id, published, color_mode, is_healed);

-- Tiers: a free basic page and the full plan. Founding and the old plans stay as "full".
alter table public.studios drop constraint if exists studios_plan_check;
alter table public.studios add constraint studios_plan_check check (plan in ('basic', 'full', 'founding', 'artist', 'pro', 'studio'));
alter table public.studios alter column plan set default 'basic';
