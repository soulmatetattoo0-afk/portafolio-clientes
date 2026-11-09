-- The showcase: an artist can let visitors walk the whole road in a demo. A
-- guest (no account yet) who books with them talks to a stand-in of the
-- artist that answers on its own: it writes back, sends and edits a
-- proposal, takes a simulated deposit, "does" the session and collects the
-- rest. The stand-in lives in its own studio with nobody in it, so none of it
-- reaches the real artist's inbox, calendar, Caja or numbers.
alter table public.artists add column if not exists showcase boolean not null default false;
-- On the stand-in: which artist it stands in for.
alter table public.artists add column if not exists showcase_of uuid references public.artists (id) on delete cascade;
create unique index if not exists artists_showcase_of_idx on public.artists (showcase_of) where showcase_of is not null;

update public.artists set showcase = true where slug = 'soulmate-tattoo';
