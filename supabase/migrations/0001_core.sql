-- Core schema: studios (tenants), artists, client briefs, quotes, bookings.
-- Every tenant-owned row carries studio_id. The app server talks to Postgres
-- with a privileged role and scopes every query by the signed-in member's
-- studio; RLS is the second wall, so a leaked anon key can read nothing.

create extension if not exists btree_gist;

create schema if not exists private;

-- ---------------------------------------------------------------- tenants

create table public.studios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'),
  name text not null,
  kind text not null default 'solo' check (kind in ('solo', 'studio')),
  plan text not null default 'founding' check (plan in ('founding', 'artist', 'pro', 'studio')),
  subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'),
  display_name text not null,
  headline text,
  bio text,
  instagram text,
  home_city text,
  styles text[] not null default '{}',
  accepting boolean not null default true,
  min_price_cents integer check (min_price_cents >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  -- Deposit rules shown to clients before they pay; versioned on every quote.
  deposit_policy jsonb not null default jsonb_build_object(
    'refundable', false,
    'reschedule_notice_hours', 72,
    'reschedules_allowed', 1,
    'applies_to_final_price', true
  ),
  stripe_account_id text unique,
  stripe_charges_enabled boolean not null default false,
  portrait_path text,
  created_at timestamptz not null default now()
);
create index artists_studio_idx on public.artists (studio_id);

create table public.members (
  studio_id uuid not null references public.studios (id) on delete cascade,
  user_id uuid not null,
  email text not null,
  role text not null default 'owner' check (role in ('owner', 'artist', 'assistant')),
  locale text not null default 'en' check (locale in ('en', 'es')),
  artist_id uuid references public.artists (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (studio_id, user_id)
);
create index members_user_idx on public.members (user_id);
create index members_email_idx on public.members (lower(email));

-- Guest spots and the home studio: every booking happens at a stop, in that city's time zone.
create table public.tour_stops (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  city text not null,
  country text not null,
  studio_name text,
  address text,
  timezone text not null,
  starts_on date,
  ends_on date,
  is_home boolean not null default false,
  status text not null default 'booking' check (status in ('announced', 'booking', 'full', 'done')),
  created_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index tour_stops_artist_idx on public.tour_stops (artist_id, starts_on);

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  image_path text,
  width integer,
  height integer,
  title text,
  style text,
  color_mode text check (color_mode in ('black_grey', 'color')),
  placement text,
  is_healed boolean not null default false,
  sort integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create index portfolio_artist_idx on public.portfolio_items (artist_id, sort);

-- ---------------------------------------------------------------- clients & briefs

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  instagram text,
  locale text not null default 'en' check (locale in ('en', 'es')),
  created_at timestamptz not null default now()
);
create unique index clients_studio_email_uq on public.clients (studio_id, lower(email));

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  ref text not null unique,
  status text not null default 'new'
    check (status in ('new', 'needs_info', 'quoted', 'booked', 'declined', 'archived')),
  style text not null,
  color_mode text not null check (color_mode in ('black_grey', 'color', 'undecided')),
  placement text not null,
  full_coverage boolean not null default false,
  body text not null check (body in ('f', 'm')),
  body_height_cm integer check (body_height_cm between 120 and 230),
  size_w_cm numeric(5, 1),
  size_h_cm numeric(5, 1),
  placement_detail jsonb not null default '{}',
  description text not null check (char_length(description) between 10 and 4000),
  avoid text check (char_length(avoid) <= 2000),
  is_coverup boolean not null default false,
  is_first_tattoo boolean not null default false,
  budget_min_cents integer check (budget_min_cents >= 0),
  budget_max_cents integer check (budget_max_cents >= budget_min_cents),
  currency text not null default 'usd',
  timing text not null default 'flexible' check (timing in ('asap', 'flexible', 'specific')),
  preferred_dates text check (char_length(preferred_dates) <= 500),
  tour_stop_id uuid references public.tour_stops (id) on delete set null,
  attribution jsonb not null default '{}',
  ai_summary jsonb,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index briefs_inbox_idx on public.briefs (studio_id, status, created_at desc);
create index briefs_client_idx on public.briefs (client_id);

create table public.brief_files (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  brief_id uuid not null references public.briefs (id) on delete cascade,
  kind text not null check (kind in ('reference', 'skin', 'placement')),
  path text not null,
  mime text not null,
  bytes integer not null check (bytes > 0),
  created_at timestamptz not null default now()
);
create index brief_files_brief_idx on public.brief_files (brief_id);

-- The conversation and audit trail of a brief, newest last.
create table public.brief_events (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  brief_id uuid not null references public.briefs (id) on delete cascade,
  kind text not null check (kind in ('created', 'info_requested', 'client_replied', 'quoted', 'declined', 'paid', 'note')),
  actor text not null check (actor in ('client', 'artist', 'system')),
  body text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index brief_events_brief_idx on public.brief_events (brief_id, created_at);

-- ---------------------------------------------------------------- quotes & bookings

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  brief_id uuid not null references public.briefs (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  token text not null unique check (char_length(token) >= 24),
  price_min_cents integer not null check (price_min_cents > 0),
  price_max_cents integer check (price_max_cents >= price_min_cents),
  sessions integer not null default 1 check (sessions between 1 and 40),
  hours_per_session numeric(3, 1) check (hours_per_session > 0),
  deposit_cents integer not null check (deposit_cents > 0),
  currency text not null default 'usd',
  message text check (char_length(message) <= 3000),
  policy jsonb not null,
  expires_at timestamptz not null,
  status text not null default 'sent' check (status in ('sent', 'viewed', 'paid', 'expired', 'withdrawn')),
  accepted_at timestamptz,
  accepted_ip text,
  created_at timestamptz not null default now()
);
create index quotes_brief_idx on public.quotes (brief_id);

create table public.quote_slots (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  timezone text not null,
  tour_stop_id uuid references public.tour_stops (id) on delete set null,
  status text not null default 'offered' check (status in ('offered', 'held', 'booked', 'released')),
  hold_expires_at timestamptz
);
create index quote_slots_quote_idx on public.quote_slots (quote_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  brief_id uuid references public.briefs (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  slot_id uuid references public.quote_slots (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  timezone text not null,
  city text,
  session_no integer not null default 1,
  status text not null default 'confirmed' check (status in ('confirmed', 'completed', 'no_show', 'cancelled')),
  created_at timestamptz not null default now(),
  -- The database itself refuses double bookings for an artist.
  constraint appointments_no_overlap exclude using gist (
    artist_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
);
create index appointments_artist_idx on public.appointments (artist_id, starts_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  provider text not null check (provider in ('stripe', 'demo')),
  checkout_id text unique,
  payment_intent_id text,
  amount_cents integer not null check (amount_cents > 0),
  application_fee_cents integer not null default 0,
  currency text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'failed')),
  created_at timestamptz not null default now()
);
create index payments_quote_idx on public.payments (quote_id);

-- ---------------------------------------------------------------- comms

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  tour_stop_id uuid references public.tour_stops (id) on delete cascade,
  city text not null,
  email text not null,
  name text,
  instagram text,
  locale text not null default 'en',
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index waitlist_unique_uq on public.waitlist (artist_id, lower(email), lower(city));

-- Every email goes through this queue: confirmations now, reminders later.
create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references public.studios (id) on delete cascade,
  to_email text not null,
  reply_to text,
  subject text not null,
  html text not null,
  text_body text not null,
  template text not null,
  dedupe_key text unique,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create index outbox_due_idx on public.outbox (send_after) where sent_at is null;

create table public.artist_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  instagram text,
  city text,
  locale text not null default 'en',
  created_at timestamptz not null default now()
);
create unique index artist_leads_email_uq on public.artist_leads (lower(email));

create table public.webhook_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS

create or replace function private.is_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.studio_id = target and m.user_id = (select auth.uid())
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'studios', 'artists', 'members', 'tour_stops', 'portfolio_items', 'clients', 'briefs',
    'brief_files', 'brief_events', 'quotes', 'quote_slots', 'appointments', 'payments',
    'waitlist', 'outbox', 'webhook_events', 'artist_leads'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy studios_member_read on public.studios for select to authenticated
  using (private.is_member(id));

do $$
declare t text;
begin
  foreach t in array array[
    'artists', 'tour_stops', 'portfolio_items', 'clients', 'briefs', 'brief_files',
    'brief_events', 'quotes', 'quote_slots', 'appointments', 'payments', 'waitlist'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.is_member(studio_id)) with check (private.is_member(studio_id))',
      t || '_member_all', t
    );
  end loop;
end $$;

create policy members_self_read on public.members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_member(studio_id));

-- Public profile data is served by the app server, never straight from the anon key.
revoke all on all tables in schema public from anon;

grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
