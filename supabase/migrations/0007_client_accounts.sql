-- Clients get an account of their own: the people who look for artists, save
-- them, and follow their requests and appointments in one place.

create table if not exists public.client_users (
  user_id uuid primary key,                 -- auth.users id; no FK because the local database has no auth.users
  email text not null,
  name text,
  locale text not null default 'en' check (locale in ('en', 'es')),
  home_city text,
  city_slug text,
  lat double precision,
  lng double precision,
  alerts jsonb not null default '{"spots": true, "books_open": true, "issue": true, "new_work": false}',
  created_at timestamptz not null default now()
);
create unique index if not exists client_users_email_uq on public.client_users (lower(email));

-- A studio's client record can belong to a signed-in person; linked by email on first sign-in.
alter table public.clients add column if not exists user_id uuid;
create index if not exists clients_user_idx on public.clients (user_id);

create table if not exists public.follows (
  user_id uuid not null,
  artist_id uuid not null references public.artists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);
create index if not exists follows_artist_idx on public.follows (artist_id, created_at);

create table if not exists public.saves (
  user_id uuid not null,
  portfolio_item_id uuid not null references public.portfolio_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, portfolio_item_id)
);
create index if not exists saves_item_idx on public.saves (portfolio_item_id, created_at);

create table if not exists public.city_follows (
  user_id uuid not null,
  city_slug text not null,
  trade text not null default 'tattoo',
  created_at timestamptz not null default now(),
  primary key (user_id, city_slug, trade)
);

-- RLS: a person reads and writes only their own rows; the app server scopes by user as well.
do $$
declare t text;
begin
  foreach t in array array['client_users', 'follows', 'saves', 'city_follows'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_self', t);
  end loop;
end $$;

create or replace function private.is_my_client(target_client uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clients c where c.id = target_client and c.user_id = (select auth.uid()));
$$;

create policy briefs_client_read on public.briefs for select to authenticated using (private.is_my_client(client_id));
create policy appointments_client_read on public.appointments for select to authenticated using (private.is_my_client(client_id));
create policy quotes_client_read on public.quotes for select to authenticated
  using (exists (select 1 from public.briefs b where b.id = brief_id and private.is_my_client(b.client_id)));
create policy quote_slots_client_read on public.quote_slots for select to authenticated
  using (exists (select 1 from public.quotes q join public.briefs b on b.id = q.brief_id where q.id = quote_id and private.is_my_client(b.client_id)));
create policy payments_client_read on public.payments for select to authenticated
  using (exists (select 1 from public.quotes q join public.briefs b on b.id = q.brief_id where q.id = quote_id and private.is_my_client(b.client_id)));
create policy brief_files_client_read on public.brief_files for select to authenticated
  using (exists (select 1 from public.briefs b where b.id = brief_id and private.is_my_client(b.client_id)));
create policy brief_events_client_read on public.brief_events for select to authenticated
  using (exists (select 1 from public.briefs b where b.id = brief_id and private.is_my_client(b.client_id)));

revoke all on public.client_users, public.follows, public.saves, public.city_follows from anon;
grant execute on function private.is_my_client(uuid) to authenticated;
