-- The rest of the tattoo, paid in the chat on the day of the session.
-- A payment is either the deposit that books the date or the balance paid at
-- the studio; the artist sets the balance they agreed with the client.

alter table public.payments add column if not exists kind text not null default 'deposit';
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('deposit', 'balance'));

alter table public.appointments add column if not exists balance_cents integer;
alter table public.appointments drop constraint if exists appointments_balance_check;
alter table public.appointments add constraint appointments_balance_check check (balance_cents is null or balance_cents >= 0);

alter table public.brief_events drop constraint if exists brief_events_kind_check;
alter table public.brief_events add constraint brief_events_kind_check
  check (kind in ('created', 'info_requested', 'client_replied', 'quoted', 'declined', 'paid', 'note', 'message', 'offer', 'balance_paid'));
