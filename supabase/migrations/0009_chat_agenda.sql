-- Every request opens a conversation between the client and the artist.
-- brief_events already holds the brief's history; messages and reservation
-- offers join it. The client reads the conversation through a private link.
alter table public.brief_events drop constraint if exists brief_events_kind_check;
alter table public.brief_events add constraint brief_events_kind_check
  check (kind in ('created', 'info_requested', 'client_replied', 'quoted', 'declined', 'paid', 'note', 'message', 'offer'));

alter table public.briefs add column if not exists chat_token text unique
  default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
update public.briefs set chat_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') where chat_token is null;
-- When each side last read the conversation, for unread counts.
alter table public.briefs add column if not exists client_read_at timestamptz;
alter table public.briefs add column if not exists artist_read_at timestamptz;

-- The artist's agenda: whole days they don't take bookings.
create table if not exists public.days_off (
  artist_id uuid not null references public.artists (id) on delete cascade,
  studio_id uuid not null references public.studios (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (artist_id, day)
);

-- Same wall as every studio table: members of the studio only.
alter table public.days_off enable row level security;
create policy days_off_member on public.days_off for all to authenticated
  using (private.is_member(studio_id)) with check (private.is_member(studio_id));
