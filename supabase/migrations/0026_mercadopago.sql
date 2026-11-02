-- Mercado Pago for artists in Chile: each artist links their own account
-- (OAuth), the client pays the deposit in the app plus VANTA's service fee,
-- and Mercado Pago splits the payment (the artist gets the deposit, VANTA its
-- marketplace fee). The artist's tokens are stored sealed (AES-GCM, APP_SECRET).
alter table public.artists add column if not exists mp_user_id text;
alter table public.artists add column if not exists mp_access_token text;
alter table public.artists add column if not exists mp_refresh_token text;
alter table public.artists add column if not exists mp_token_expires_at timestamptz;

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('stripe', 'demo', 'manual', 'mercadopago'));
-- What the client paid on top of the deposit for VANTA's service (the deposit itself stays in amount_cents).
alter table public.payments add column if not exists service_fee_cents integer not null default 0;

-- VANTA Pro paid with a Mercado Pago subscription (preapproval) from Chile.
alter table public.studios add column if not exists mp_preapproval_id text;
