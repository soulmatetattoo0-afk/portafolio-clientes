-- The artist can hand the client their calendar instead of one date: the quote
-- then carries where and at what hour, and the client picks the day from the
-- open ones. Defaults for the offer form live on the artist.

alter table public.quotes add column if not exists pick_stop_id uuid references public.tour_stops (id) on delete set null;
alter table public.quotes add column if not exists pick_time text;
alter table public.quotes add column if not exists pick_until date;

alter table public.artists add column if not exists default_deposit_cents integer check (default_deposit_cents >= 0);
alter table public.artists add column if not exists default_session_hours numeric(3, 1) check (default_session_hours > 0);
alter table public.artists add column if not exists default_start_time text;
