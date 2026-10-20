-- The illustration across the top of the artist's paper calendar: their own
-- art, a photo or a piece. Until they set one, the page uses one of their pieces.
alter table public.artists add column if not exists calendar_art_path text;
