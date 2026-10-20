-- Who is inside the app right now: the open app says so every ~40 s. Chat emails skip whoever was seen in the last two minutes.
alter table public.client_users add column if not exists last_seen_at timestamptz;
alter table public.members add column if not exists last_seen_at timestamptz;
