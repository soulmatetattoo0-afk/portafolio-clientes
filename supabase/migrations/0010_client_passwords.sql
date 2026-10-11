-- People sign up with a username, an email and a password. In production the
-- password lives in Supabase Auth; password_hash is only for the local
-- database, where there is no auth service.
alter table public.client_users add column if not exists username text;
alter table public.client_users add column if not exists password_hash text;
create unique index if not exists client_users_username_uq on public.client_users (lower(username));
