# Brief

Booking and client management for tattoo artists. The working name is **Brief**; the brand name lives in a handful of strings (`src/i18n/*.ts`, `src/components/Chrome.tsx`, `src/lib/env.ts`) so it can change in one pass.

Clients tell the artist their idea through a guided brief: style, the exact placement on a 3D statue mannequin, the size in real centimetres at their own height, references, what they don't want, dates, city and budget. The artist reads a clean brief, sends a quote with two or three dates, and the client confirms by paying a deposit that goes straight to the artist's Stripe account. Reminders and confirmations go out by email in the client's language (English or Spanish).

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables the whole product runs on local stand-ins:

| Service | Local stand-in |
| --- | --- |
| Database | Embedded Postgres (PGlite) in `.data/pglite`, created and seeded on first request |
| Auth | "Enter the demo studio" button on `/login` |
| Storage | Files in `.data/files`, served through signed URLs |
| Payments | Deposits are simulated and confirm the booking immediately |
| Email | Logged to the server console and kept in the `outbox` table |

Try it:

- `/` is the page for artists.
- `/camo` is a sample artist page (`/iris` a second one). "Tell me your idea" opens the client brief.
- `/login`, then "Enter the demo studio", opens the artist studio with a request in every stage.

Delete `.data/` to start from a fresh seed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | Route types plus TypeScript |
| `npm run lint` | ESLint |
| `npm run mannequin:build` | Regenerates the 3D bodies with Blender (see below) |

## How it's built

- **Next.js 16** (App Router, server actions) with Tailwind CSS 4. No component library: the noir and gilt design tokens live in `src/app/globals.css`.
- **Postgres** with row-level security (`supabase/migrations`). The server talks to the database directly and scopes every query to the signed-in member's studio. RLS is the second wall.
- **Supabase** for auth (email magic links) and storage. Client photos sit in a private bucket and are uploaded straight from the browser with signed upload URLs, because Vercel caps request bodies at 4.5 MB.
- **Stripe Connect** with Standard accounts. Each artist owns their Stripe account; deposits are direct charges, so the artist is the merchant and handles disputes. An optional platform fee is available through `PLATFORM_FEE_BPS`.
- **Resend** for email through an `outbox` table. Confirmations go out right after each action; reminders three days and one day before a session go out with the cron job.
- **three.js** for the mannequin (`src/mannequin`). One engine serves the client brief, the artist's brief view and the landing page.

### Folder map

```
src/app/                 routes: landing, [artist] (cover → deck → panels in [artist]/experience), [artist]/request, q/[token], login, studio, api
src/app/studio/(app)/    artist studio: requests, bookings, portfolio, cities, settings
src/lib/                 db, auth, storage, payments, email, booking, queries, formats
src/i18n/                English and Spanish copy (es.ts must match en.ts's shape)
src/mannequin/           zone catalog and the three.js engine
tools/mannequin/         Blender pipeline that generates the bodies
supabase/migrations/     schema, RLS and storage buckets
docs/                    going live, and the booking process explained for artists
```

### The mannequin

The bodies are generated, not modelled by hand: `tools/mannequin/body.py` describes each figure as signed-distance primitives, and `build.py` runs it through marching cubes and Blender (as a Python module, `pip install bpy==5.2.2` on Python 3.13), labels 29 tattoo zones, and exports GLB files with a `_ZONE` vertex attribute. Because the files are generated, the anatomy can be retuned by editing numbers in `body.py`. Composite placements (full sleeve, full back, leg sleeve) are groups of zones defined in `src/mannequin/catalog.ts`.

Going live: see [docs/GO-LIVE.md](docs/GO-LIVE.md). The booking process explained in Spanish, for artists and clients: [docs/GUIA-DEL-PROCESO.md](docs/GUIA-DEL-PROCESO.md).
