-- The agenda becomes the artist's own calendar: sessions they add by hand,
-- a note on any session, and the weekdays they never work.

-- A session added by hand may be for someone who never wrote through VANTA.
alter table public.clients alter column email drop not null;

alter table public.appointments add column if not exists note text;

-- ISO weekdays the artist never works (1 = Monday … 7 = Sunday).
alter table public.artists add column if not exists closed_weekdays smallint[] not null default '{}';
