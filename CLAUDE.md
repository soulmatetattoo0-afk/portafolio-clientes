# Working on this repo

@AGENTS.md

- Product: VANTA (repo name "Brief"): find your artist, read their magazine, book. Start a new session by reading `docs/ESTADO-VANTA.md` (state, decisions, pending work). Users are artists (studio at `/studio`) and their clients (public pages). README.md has the map.
- Every user-facing string lives in `src/i18n/en.ts` and `src/i18n/es.ts`; `es.ts` is typed against `en.ts`, so add keys to both. Spanish is Latin American, "tú".
- Design tokens are in `src/app/globals.css` (soot, niche, line, vellum, ash, gilt). Cinzel only for names, Cormorant Garamond for headings, Instrument Sans for UI. Gold is spent on one thing per screen. That is the studio. The public artist experience (`src/app/[artist]/experience`, the brief wizard) wears the `.poster` theme instead: ink, bone, one `--accent` per artist, Anton for display (`.p-display`), `.p-stamp` labels; grain and halftone are classes, never images.
- Server actions in `src/app/studio/(app)/actions.ts` must call `requireMember()` and scope every query by `member.studioId`.
- Local mode needs no services; delete `.data/` to reseed. Check work with `npm run typecheck`, `npm run lint` and `npm run build`.
- Mannequin zone ids are baked into `public/mannequin/*.glb`; never renumber `ZONES` in `src/mannequin/catalog.ts` or `tools/mannequin/body.py`.
