-- Notifications with the app closed (Web Push). One row per browser or phone
-- a person allowed; the endpoint identifies it. Works for clients and artists.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_self on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
