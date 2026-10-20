-- Payments made straight to the artist (Zelle, cash…) and confirmed by them in the app, while card payments are not set up.
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('stripe', 'demo', 'manual'));
