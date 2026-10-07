-- The artist's magazine: which pieces open a page of their own, and the words beside them.
alter table public.portfolio_items add column if not exists featured boolean not null default false;
alter table public.portfolio_items add column if not exists story text;
