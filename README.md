# Soulmate Tattoo — Booking Website

A full-stack Next.js 14 booking platform for **Soulmate Tattoo**, featuring Supabase auth & database, Stripe payment processing, Resend email notifications, and a luxury dark aesthetic.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database & Auth**: Supabase
- **Payments**: Stripe (€50 reservation fee)
- **Email**: Resend
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Image uploads**: Cloudinary

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Stripe](https://stripe.com) account
- A [Resend](https://resend.com) account
- A [Cloudinary](https://cloudinary.com) account (for portfolio images)

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (admin operations) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Your Resend API key |
| `RESEND_FROM_EMAIL` | Verified sender email in Resend |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Your Cloudinary unsigned upload preset |
| `NEXT_PUBLIC_APP_URL` | App base URL (e.g. `http://localhost:3000`) |
| `ADMIN_EMAIL` | Admin notification email address |

---

## Supabase Database Schema

Run the following SQL in your Supabase SQL Editor (**Database → SQL Editor → New query**):

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── PROFILES ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  full_name    text,
  email        text,
  role         text not null default 'client' check (role in ('client', 'admin')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─── AVAILABILITY ─────────────────────────────────────────────────────────────
create table public.availability (
  id           uuid default uuid_generate_v4() primary key,
  date         date not null unique,
  is_available boolean not null default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.availability enable row level security;

-- Public can read availability
create policy "Anyone can read availability"
  on public.availability for select
  using (true);

-- Only admins can modify availability
create policy "Admins can manage availability"
  on public.availability for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─── BOOKINGS ─────────────────────────────────────────────────────────────────
create table public.bookings (
  id                         uuid default uuid_generate_v4() primary key,
  user_id                    uuid references auth.users(id) on delete cascade not null,
  date                       date not null,
  description                text not null,
  status                     text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  stripe_payment_intent_id   text,
  created_at                 timestamptz default now(),
  updated_at                 timestamptz default now()
);

alter table public.bookings enable row level security;

-- Users can view their own bookings
create policy "Users can view own bookings"
  on public.bookings for select
  using (auth.uid() = user_id);

-- Users can insert their own bookings
create policy "Users can insert own bookings"
  on public.bookings for insert
  with check (auth.uid() = user_id);

-- Admins can view all bookings
create policy "Admins can view all bookings"
  on public.bookings for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can update all bookings
create policy "Admins can update all bookings"
  on public.bookings for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─── PAYMENTS ─────────────────────────────────────────────────────────────────
create table public.payments (
  id                         uuid default uuid_generate_v4() primary key,
  booking_id                 uuid references public.bookings(id) on delete cascade not null,
  user_id                    uuid references auth.users(id) on delete cascade not null,
  stripe_payment_intent_id   text not null unique,
  amount                     integer not null,  -- in cents
  currency                   text not null default 'eur',
  status                     text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  created_at                 timestamptz default now(),
  updated_at                 timestamptz default now()
);

alter table public.payments enable row level security;

-- Users can view their own payments
create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

-- Admins can view all payments
create policy "Admins can view all payments"
  on public.payments for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─── AUTO-UPDATE updated_at ───────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profiles_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger on_bookings_updated
  before update on public.bookings
  for each row execute procedure public.handle_updated_at();

create trigger on_payments_updated
  before update on public.payments
  for each row execute procedure public.handle_updated_at();

create trigger on_availability_updated
  before update on public.availability
  for each row execute procedure public.handle_updated_at();

-- ─── CREATE ADMIN USER ────────────────────────────────────────────────────────
-- After creating your admin account via the signup page, run:
-- update public.profiles set role = 'admin' where email = 'your-admin@email.com';
```

---

## Stripe Webhook Setup

### Local Development (using Stripe CLI)

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Login: `stripe login`
3. Forward webhooks to your local dev server:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

4. Copy the webhook signing secret (starts with `whsec_`) into `STRIPE_WEBHOOK_SECRET`

### Production (Vercel)

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Endpoint URL: `https://your-domain.com/api/stripe/webhook`
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
5. Copy the **Signing secret** into your Vercel environment variables as `STRIPE_WEBHOOK_SECRET`

---

## Cloudinary Setup

1. Create a [Cloudinary](https://cloudinary.com) account
2. Go to **Settings → Upload → Upload presets**
3. Create an **unsigned** upload preset
4. Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` in your env
5. Add the Cloudinary script to your layout if using the upload widget:

```html
<script src="https://upload-widget.cloudinary.com/global/all.js" type="text/javascript"></script>
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Setting up Admin Access

1. Create an account via `/signup`
2. In Supabase SQL Editor, run:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin@email.com';
```

3. Navigate to `/admin` to access the admin dashboard

---

## Adding Available Dates

Via the Admin Panel (`/admin` → Calendar tab):
- Click any future date to toggle its availability
- Gold = available for booking
- Dimmed = unavailable

Via SQL (bulk insert):
```sql
insert into public.availability (date, is_available)
values
  ('2024-02-01', true),
  ('2024-02-03', true),
  ('2024-02-07', true),
  ('2024-02-08', true)
on conflict (date) do update set is_available = excluded.is_available;
```

---

## Deploying to Vercel

1. Push your code to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.example`
4. Set `NEXT_PUBLIC_APP_URL` to your Vercel deployment URL
5. Deploy

```bash
# Or deploy via CLI
npx vercel --prod
```

---

## Project Structure

```
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout (fonts, metadata)
│   ├── globals.css                 # Global styles + Tailwind
│   ├── book/
│   │   ├── page.tsx                # Booking calendar page
│   │   └── checkout/
│   │       └── page.tsx            # Checkout (3-step flow)
│   ├── dashboard/
│   │   ├── page.tsx                # Client dashboard (server)
│   │   └── DashboardClient.tsx     # Logout button (client)
│   ├── admin/
│   │   ├── page.tsx                # Admin page (server, auth check)
│   │   └── AdminDashboard.tsx      # Full admin UI (client)
│   ├── login/page.tsx              # Login page
│   ├── signup/page.tsx             # Signup page
│   └── api/
│       ├── availability/route.ts           # GET: public availability
│       ├── admin/availability/route.ts     # POST: toggle availability (admin)
│       ├── stripe/
│       │   ├── create-payment-intent/route.ts
│       │   └── webhook/route.ts
│       └── send-email/route.ts
├── components/
│   ├── Nav.tsx                     # Fixed navigation
│   └── Calendar.tsx                # Reusable calendar component
├── lib/
│   ├── stripe.ts                   # Stripe instance
│   └── supabase/
│       ├── client.ts               # Browser Supabase client
│       └── server.ts               # Server Supabase client
├── middleware.ts                   # Auth + role protection
├── tailwind.config.ts
├── next.config.mjs
└── .env.example
```

---

## Design System

| Token | Value |
|---|---|
| Background | `#080808` |
| Card | `#161616` |
| Gold accent | `#C9A84C` |
| Text | `#DADADA` |
| Muted text | `#888888` |
| Border | `#2A2A2A` |
| Font (headings) | Cormorant Garamond |
| Font (body) | Jost |

---

## License

MIT — see [LICENSE](./LICENSE)
