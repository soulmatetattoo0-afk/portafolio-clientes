# VANTA · el mundo fuera del perfil

## Contexto

Hoy la plataforma (nombre de trabajo "Brief", marca provisional "Soot") es un perfil de artista excelente y un flujo de reserva completo para tatuadores: portada → deck → paneles (revista digital, muro, flash, reservar, guest spots), brief con maniquí 3D, cotización desde el estudio, depósito por Stripe Connect, citas y recordatorios. Fuera del perfil no hay mundo: `/explore` es un teaser con tarjetas sin enlace, buscador y chips muertos, tarjetas falsas de "próximamente" y una reja de "descarga la app". No existen cuentas de cliente, categoría de oficio, búsqueda, favoritos ni ciudades.

Objetivo: Vanta es donde encuentras a tu artista ideal, ves su obra y su revista, y reservas o cotizas según el oficio. Tres voces guían el diseño: el **arquitecto** (sistema), el **artista** (quiere llegar a clientes que valoren su estilo, llenar guest spots, cobrar depósitos sin perseguir a nadie) y el **cliente** (quiere encontrar al artista correcto por estilo, ciudad y precio, ver trabajo curado, entender cómo reservar, y seguir sus briefs y citas en un solo lugar).

### Decisiones tomadas por Camo

1. **Cuentas de cliente ligeras** (email, Apple/Google): guardar y seguir artistas, ver briefs, cotizaciones y citas, avisos de guest spots.
2. **Tatuaje primero, sistema listo para más**: `trade` (oficio) como categoría de primera clase; barberos y graffiti/mural se activan después.
3. **El mundo = VANTA la revista + un buscador**: revista digital periódica mundial (mensual al inicio, semanal cuando haya volumen), sostenible de producir; y un buscador real para entrar a perfiles a investigar.
4. **Web + PWA primero**, tiendas después; se elimina la reja "descarga la app".
5. **Nivel gratis cobra depósitos con comisión** (`PLATFORM_FEE_BPS`, ej. 5%); nivel completo $22/mes sin comisión y con flash, guest spots, capítulos de revista, envíos a VANTA y avisos a seguidores.
6. **Sin casilla de consentimiento por pieza**: el artista responde por su portafolio.
7. **La raíz `/` es el mundo para clientes**; la venta a artistas se mueve a `/artists`.
8. **"Cerca de ti" es opt-in**: botón "Usar mi ubicación"; nunca guardamos coordenadas.
9. Marca: **VANTA** reemplaza Soot/Brief en `src/lib/brand.ts` y en todo el copy.

---

## A. Arquitectura y navegación (lado cliente)

| Ruta | Qué muestra | Tema |
|---|---|---|
| `/` | **Portada de Vanta**: cabecera VANTA + número de edición; tarjeta de la edición actual (→ `/issue`); buscador (→ `/explore?q=`); chips de oficio (Tatuaje activo; Barberos/Graffiti son enlaces reales a su estado vacío, sin tarjetas falsas); franja "Cerca de ti" (6 `ArtistCard`); franja "Guest spots este mes cerca de ti"; pie con "Para artistas" → `/artists`, idioma, aviso de instalación. | poster, acento de casa |
| `/artists` | La landing de artistas actual (`src/app/page.tsx` movida), precios Básico $0 / Completo $22. `/login` sigue para artistas. | estudio |
| `/explore` | **Buscador**: filtros, orden, grilla de `ArtistCard`, estados vacíos. Se conserva el nombre (el Deck ya enlaza ahí, i18n `explore` existe, start_url de la PWA). | poster |
| `/city/[slug]` | **Página de ciudad**: "Basados en {ciudad}", "De guest en {ciudad}" (paradas próximas con fechas y enlace a reservar), "Seguir {ciudad}", "Pide que venga un artista" (reusa `CityRequest`). | poster |
| `/issue`, `/issue/[n]`, `/issues` | Última edición publicada; una edición (`?p={entryId}` abre en ese capítulo para compartir); archivo de portadas. | poster, acento por capítulo |
| `/[artist]` | Perfil existente sin cambios de estructura. Se agrega: botón Guardar/Seguir en la cabecera del Deck; sello "En VANTA No. 3" en la portada de la revista y un capítulo "En VANTA" cuando aplique; franja "Más como {artista}" al cierre de la revista y al pie del muro (`relatedArtists()`); en Spots, enlace "Otros en {ciudad} estas fechas" → `/city/[slug]`. | acento del artista |
| `/[artist]/request` | Wizard existente, prellenado si el cliente está logueado. | poster |
| `/me` | Resumen del cliente: próxima cita, cotizaciones abiertas (Pagar → `/q/[token]`), guest spots de artistas seguidos, artistas guardados, edición actual. | poster |
| `/me/saved`, `/me/briefs`, `/me/briefs/[id]`, `/me/appointments`, `/me/alerts`, `/me/settings`, `/me/signin` | Guardados (artistas y piezas), briefs con línea de tiempo (`brief_events`) y archivos por URL firmada, citas con `.ics`, avisos (guest spots de seguidos, libros abiertos, nueva edición, obra nueva; ciudades seguidas), perfil y borrar cuenta, inicio de sesión (magic link + Google/Apple; en local "Entrar como cliente demo"). | poster |
| `/admin/issues`, `/admin/issues/[id]`, `/admin/submissions`, `/admin/plans` | Mesa de edición mínima; `requireAdmin()` por `ADMIN_EMAILS`. | estudio |

- Agregar a `RESERVED` en `src/app/studio/onboarding/actions.ts`: `artists, explore, search, city, cities, issue, issues, vanta, me, signin, join, tattoo, barber, barbers, graffiti, murals, saved, account, admin`.
- `src/proxy.ts`: ampliar el matcher a `/me/:path*`, `/admin/:path*`, `/`, `/explore`.
- Chrome compartido: `src/components/world/WorldBar.tsx` (VANTA en `p-display` → `/`, lupa → `/explore`, "Yo" o "Entrar" → `/me/signin?next=`, `LangToggle`). `InstallHint.tsx` hereda la lógica de `beforeinstallprompt` de `ExploreGate.tsx` como franja descartable en `/` y `/me`. Se borra `ExploreGate.tsx`; `manifest.ts` pasa a `start_url: "/?source=pwa"`.
- **Un acento por pantalla en el mundo**: el `.poster` raíz fija `--accent` al acento de casa (`BRAND.accent`). Las tarjetas en listas nunca llevan el acento de su artista (hoy Explore se ve arcoíris); solo el elemento líder de una sección (portada de la edición, primer resultado por afinidad, artista destacado de una ciudad) recibe `style={{ "--accent": artist.accent }}`. En el lector de la edición cada capítulo es pantalla completa, así que cada capítulo fija el acento de su artista (nuevo prop `accent` en `Chapter`); los capítulos sin artista usan el de casa.
- `src/lib/catalog.ts` gana `TRADES` (`tattoo | barber | graffiti`, etiquetas en/es, modo de reserva por defecto) y `TRADE_BY_SLUG`.

---

## B. VANTA, la revista periódica

### Modelo (migración `0008_issues.sql`)

- `issues`: `number` único, `slug` ("no-01"), `title`/`lead` jsonb {en, es}, `cover_entry_id`, `cover_image_path`, `accent`, `status` draft|scheduled|published, `period_start`/`period_end` (qué cuenta como "nuevo"), `published_at`.
- `issue_entries`: `kind` cover|editorial|piece|artist|city|flash|calendar|new_in|colophon; `template` split|split-r|bleed|quote|contact|list|grid|calendar; `position`; `status` candidate|picked|dropped; `source` auto|submission|editor; `score`; referencias opcionales a `artist_id`, `portfolio_item_id`, `flash_id`, `tour_stop_id`, `city_slug`; `title`/`body` jsonb; `data` jsonb (ids para grillas/listas/calendario).
- `submissions`: `studio_id`, `artist_id`, `portfolio_item_id`, `note`, `status` pending|accepted|declined, `issue_id`; índice único parcial de una pendiente por pieza.
- RLS: `submissions` con `private.is_member(studio_id)`; `issues`/`issue_entries` sin política para `authenticated` (solo el servidor); `revoke` a `anon`.
- En `0006`: `portfolio_items.published_at` (señal de recencia que sobrevive al reordenar).

### Armado (`src/lib/issue/assemble.ts`, `score.ts`)

`assembleIssue({ number, periodStart, periodEnd })` crea el borrador y carga candidatos:
- Piezas publicadas con imagen en el periodo. Puntaje: destacada con historia ≥ 80 caracteres +3; curada +1; recencia `3·exp(−días/30)`; guardados en el periodo `min(3, n/5)`; nuevos seguidores del artista `min(2, n/10)`; briefs del artista `min(2, n/3)`; envío pendiente +4 (`source='submission'`); segunda pieza del mismo artista ×0.5, tercera ×0.25.
- Entradas: top 12 `piece`; `new_in` (artistas cuya primera pieza es del periodo); 3 `city` con más paradas próximas en 45 días; un `calendar` (paradas en 45 días por semana); un `flash` (hasta 8 diseños disponibles creados en el periodo).
- Nunca publica sola. Cron `src/app/api/cron/issue/route.ts` (protegido por `CRON_SECRET`, agregado a `vercel.json`) arma el siguiente número al inicio de cada ciclo. `ISSUE_CADENCE` en `src/lib/issue/config.ts`: mensual para los números 1–3, semanal al pasar ~40 artistas activos.
- Asistencia opcional de IA (`src/lib/issue/draft.ts`, solo si `ANTHROPIC_API_KEY` existe): propone título, bajada y una línea por capítulo en ambos idiomas a partir de las historias de los artistas; el editor siempre revisa. La línea del editor (`BRAND.editor`) va en el colofón.

### Mesa de edición (`/admin`)

- `requireAdmin()` en `src/lib/auth.ts`: sesión + email en `ADMIN_EMAILS` (en local, el email del miembro demo).
- `/admin/issues`: lista + "Armar siguiente". `/admin/issues/[id]`: candidatos por tipo con puntaje y miniatura; elegir/descartar, posición, plantilla por entrada, portada, textos en/es, "Vista previa", "Publicar" (fija `published_at`, encola `issuePublished` a clientes con el aviso activo, dedupe `issue:{n}:{email}`), "Despublicar". `/admin/submissions`: aceptar (crea entrada en el borrador abierto) o declinar con una línea por email.
- Todas las acciones en `src/app/admin/actions.ts` llaman `requireAdmin()`.

### Lector

Extraer de `src/app/[artist]/experience/panels/Bio.tsx` a `src/components/mag/` sin cambiar comportamiento, y que `Bio.tsx` importe de ahí:
- `Mag.tsx` (scroller con snap, rueda, teclado, arrastre) con props nuevos `initialKey`, `onChange(key)` (el lector actualiza la URL con `replaceState` para compartir por capítulo) y `bar`.
- `Chapter.tsx` (`Ch`) con `accent`; `Fig.tsx`, `Head.tsx`, `Fact.tsx`, `Stat.tsx`, `Stop.tsx`; `spreads.tsx` con `Split`, `Bleed`, `Quote` y un `Contact` nuevo (la hoja de contacto hoy inline). Las plantillas reciben `spread: { url, title, story, line, specs, pos, href? }` en vez de `PortfolioItem`. `posOf()` y `after()` pasan a `src/components/mag/rules.ts`.
- Capítulos propios de la edición en `src/app/issue/chapters.tsx`: `IssueCover` (cabecera VANTA, No., mes, foto, artista de portada), `Editorial`, `CityDispatch`, `FlashDrop` (reusa la tarjeta de `panels/Flash.tsx`, extraída a `src/components/world/FlashCard.tsx`), `Calendar`, `NewIn`, `Colophon` (gracias, línea del editor, "Envía tu obra" → `/artists`, compartir).
- `src/app/issue/[n]/page.tsx` carga `getIssue(n)` + entradas (artistas, piezas, paradas; URLs vía `fileUrl`) y renderiza `IssueReader`; cada `piece` va a `Split`/`Bleed`/`Quote` según `template`, con el acento del artista, kicker `"{posición} · {artista}"`, specs con ciudad y "Solicitar" → `/[artist]/request` si acepta.
- Compartir con `navigator.share` y `${appUrl}/issue/{n}?p={entryId}`; `generateMetadata` con la portada como OG. `IssueCard` compartido en `/`, `/me`, `/issues`.

### Cruces revista del artista ↔ edición global

- Folio de la portada en `Bio.tsx`: `VANTA · {artista} · Vol. 01`. Con `data.issues` (nuevo en `ExperienceData`, de `listArtistIssueAppearances(artistId)`) no vacío: sello "En VANTA No. 3" y capítulo "En VANTA" con enlaces a `/issue/{n}?p={entryId}`.
- Cada capítulo de pieza en la edición enlaza "Leer la revista de {artista}" → `/[artist]#bio` y "Solicitar" → `/[artist]/request`.
- El objeto Portrait del Deck (`objects.tsx`) mantiene `VANTA · Vol. 01` como volumen propio del artista.

---

## C. Buscador y páginas de ciudad

### Modelo (migración `0006_vanta_world.sql`)

- `artists`: `trade` (default tattoo), `booking_mode` brief_quote|slots|project, `country`, `city_slug`, `lat`, `lng`, `listed` (aparece en búsqueda), columna generada `search tsvector` (nombre, titular, ciudad, país, estilos) con índice GIN; índices por `city_slug` y `(trade, listed)`.
- `tour_stops`: `city_slug`, `lat`, `lng`, índice `(city_slug, starts_on)`.
- `portfolio_items`: `published_at` + índice de facetas `(artist_id, published, color_mode, is_healed)`.
- `studios.plan`: agregar `basic` y `full` al check; default `basic`; los planes viejos se conservan (founding = completo de por vida).
- Precio desde reusa `min_price_cents`; color y curado se calculan de `portfolio_items`.
- `src/lib/geo.ts` absorbe `locate()` de `experience/cities.ts` y `countryKey()` de `frame.ts` (esos archivos reexportan), y agrega `citySlug`, `haversineKm`, `placeCity(city, country)`. `saveProfile` y `saveStop` lo llaman; ciudades desconocidas quedan sin pin pero buscables por texto. `/admin/plans` tiene "Re-geolocalizar".

### Búsqueda (`src/lib/search.ts`)

`searchArtists({ q, trade, styles[], city, color, healed, priceMax, available: now|guest, near, sort: match|next|distance|newest, page })` en una sola consulta con CTEs:
- `facets` por artista (tiene color, tiene negro y gris, tiene curado, cantidad, última publicación).
- `next_stop`: la parada más próxima no-casa con estado announced|booking y fecha vigente.
- `where`: `listed and trade`; `q` con `websearch_to_tsquery('simple')` o `ilike` en nombre; estilos con `&&`; ciudad = base o parada próxima; color/curado desde facetas; `min_price_cents <= priceMax`; `now` → `accepting`; `guest` → tiene `next_stop`.
- `rank`: `ts_rank·4 + estilos·3 + ciudad·3 + accepting + retrato + min(destacadas,3)·0.5`; `distance` por haversine a la base o a la parada (la menor); `next` = `coalesce(next_stop.starts_on, hoy si acepta)`; `newest` = última publicación. 24 por página + `count(*) over()`.
- También `relatedArtists(artistId, limit)` (mismo oficio, estilos en común, misma ciudad primero, luego más cerca), `cityPage(slug)`, `nearbySpots(near|city, days)`, `listCities()`.
- `ArtistCard` en `queries.ts` crece: `trade, country, city_slug, price_from_cents, currency, accepting, has_color, has_black_grey, has_healed, featured_count, next_stop`. Sin retrato, `CoverPlate` tipográfico (inicial, nombre, acento, halftone).

### Tarjeta, "cerca de ti", vacíos, ciudad

- `src/components/world/ArtistCard.tsx`: retrato 3:4, degradado, nombre `p-display`, estilos, ciudad + precio desde en `p-stamp`, sello de oficio, `SpotBadge` ("En Miami · 26 oct – 1 nov" con `dateRange()` de `format.ts`) si hay parada en 60 días, puntos color/negro y gris/curado, `SaveButton` (enlace a `/me/signin?next=` si no hay sesión). Toda la tarjeta es un `Link`. El "por qué" se muestra en palabras ("Realismo · En Miami la próxima semana · Obra curada"), nunca un puntaje; el nivel de pago nunca afecta el orden.
- `NearYou.tsx`: sin GPS automático. Abre con la cookie `city` (elegida en chips o del `home_city` del cliente) o la ciudad con más artistas; botón "Usar mi ubicación" pide `getCurrentPosition` y pone `near=lat,lng` redondeado a 2 decimales en la URL; nunca se guarda en servidor.
- Orden: Afinidad (default con filtros), Próxima disponibilidad, Distancia (solo con `near`), Obra más nueva.
- Vacíos: el servidor relaja filtros en orden (ciudad → estilos → color) y muestra "Nada en {ciudad} para {estilo}. Lo más cercano:", más "Seguir {ciudad}" y "¿Conoces un artista en {ciudad}? Mándale Vanta" → `/artists`. Oficio no lanzado → "Los barberos llegan a Vanta. Sigue para enterarte primero" (`city_follows` con `trade`).
- `/city/[slug]/page.tsx` con `cityPage(slug)`; `generateMetadata` "{n} tatuadores en {ciudad}". Los guest spots se vuelven señal de descubrimiento: el mismo `next_stop` alimenta el badge de la tarjeta, la página de ciudad, la franja de `/` y el capítulo calendario de la edición.

---

## D. Cuentas de cliente

### Autenticación

Misma Supabase y `supabaseServer()`; tabla `client_users` separada de `members` (una persona puede ser ambas).
- `src/lib/client.ts`: `getClientUser(session?)`, `requireClient()` (→ `/me/signin?next=`).
- `/me/signin`: `signInWithOtp` con `emailRedirectTo=/auth/callback?intent=client&next=…`; `signInWithOAuth` Google/Apple (proveedores activados en Supabase; documentar en `docs/GO-LIVE.md`). Local: "Entrar como cliente demo" → `setDevSession(DEMO_CLIENT_USER_ID, "daniel@example.com")`.
- `/auth/callback/route.ts`: con `intent=client` hace upsert de `client_users`, corre `linkClientRows(userId, email)` (`update clients set user_id … where lower(email)=… and user_id is null`) y redirige a `next` validado o `/me`. Si no, comportamiento actual (`/studio`).
- `/login/page.tsx`: sesión sin membresía pero con `client_users` → `/me`. `requireMember()` sin cambios.

### Migración `0007_client_accounts.sql`

- `client_users` (`user_id` pk sin FK porque PGlite no tiene `auth.users`; email único por `lower(email)`, name, locale, home_city/city_slug/lat/lng solo si el cliente escribe ciudad, `alerts` jsonb `{spots, books_open, issue, new_work}`).
- `clients.user_id` + índice. `follows (user_id, artist_id)`, `saves (user_id, portfolio_item_id)`, `city_follows (user_id, city_slug, trade)`.
- RLS: política `self` por `auth.uid()` en las cuatro tablas; función `private.is_my_client(client_id)` (security definer) y políticas de lectura para `briefs`, `appointments`, `quotes`, `quote_slots`, `payments`, `brief_files`, `brief_events` del cliente logueado; `revoke` a `anon`. El servidor igual filtra por `userId` en código (segunda muralla, como en el estudio).

### Consultas y acciones

- `src/lib/client.ts`: `listMyBriefs`, `getMyBrief` (archivos con `fileUrl("private")`), `listMyAppointments`, `listFollowed`, `listSaved`, `isFollowing`, `followedIds`.
- `src/app/me/actions.ts` (todas con `requireClient()`): `toggleFollow`, `toggleSave`, `toggleCityFollow`, `savePrefs`, `saveProfile`, `deleteAccount` (borra cuenta, seguidos y guardados; anula `clients.user_id`; los briefs quedan porque son registro del estudio).

### Avisos (email por `outbox`; push en fase 4)

`src/lib/alerts.ts` → `notifyFollowers(artistId, kind, payload)` a `follows` × `client_users` con el flag activo, con claves de dedupe. Ganchos: `saveStop` (parada nueva o pasa a `booking`) → `spot_announced` a seguidores y a `city_follows`; `saveProfile` cuando `accepting` pasa a true → `books_open`; `updatePortfolioItem` cuando una pieza pasa a destacada (máx. 1 por artista cada 7 días) → `new_work`; publicar edición → `issue`. Plantillas nuevas en `src/lib/messages.ts`.

### Wizard y `/q/[token]` con sesión

- `request/page.tsx` pasa `me` (nombre, email, teléfono, instagram del último `clients` del usuario); `BriefWizard` prellena (el borrador en `localStorage` gana si existe), email de solo lectura con "¿No eres tú? Salir"; `submitBrief` liga `clients.user_id` si el email coincide con la sesión. `sent` muestra "Síguelo en Vanta" → `/me/briefs/{id}` o "Crea tu cuenta para seguir esta solicitud".
- `/q/[token]`: el token sigue siendo la llave; sin login obligatorio. Con sesión y cotización propia: enlace "Mis solicitudes" y, tras pagar, "Verlo en mis citas". `PayForm` y `startDeposit` sin cambios.

---

## E. Reserva según oficio (esquema ahora, flujos en fases 3 y 4)

- `artists.trade` + `booking_mode`; por defecto tattoo → brief_quote, barber → slots, graffiti → project; el artista puede cambiarlo.
- `PANELS` en `experience/types.ts` pasa a `panelsFor(trade)`: tattoo `bio, work, flash, book, spots`; barber `bio, work, services, book, spots`; graffiti `bio, work, flash (bocetos), project, spots`. El copy del Deck se indexa por oficio.
- **Turnos (fase 3, `0009_services_slots.sql`)**: `services` (nombre, duración, precio, depósito), `availability_rules` (por día de semana y parada), `availability_exceptions`, `appointments.service_id`, `payments.kind` deposit|full|service. Flujo `/[artist]/book`: servicio → día → hora libre (`src/lib/slots.ts`: reglas − excepciones − citas confirmadas) → contacto → pago (`createServiceCheckout`, demo confirma al instante); `confirmServiceBooking` espejo de `confirmBooking`; la restricción `appointments_no_overlap` ya evita dobles reservas. Estudio: `/studio/services`.
- **Proyectos (fase 4, `0010_projects.sql`)**: `briefs.kind` tattoo|project, `briefs.project` jsonb (superficie, medidas, interior, dirección, acceso, plazo), `brief_files.kind` gana `wall`; campos de cuerpo nulos cuando `kind='project'`. `ProjectWizard.tsx` de 4 pasos y `submitProject` compartiendo helpers extraídos a `request/shared.ts`. La cotización del estudio sirve igual ("sesiones" → "días" por i18n).

---

## F. Lado artista

- Ajustes: fieldset "Descubrimiento": oficio, país, "Dónde te pone el mapa" (lat/lng de `placeCity`, aviso si la ciudad no se reconoce), precio desde, `listed`, y una lista "Lo que ve el buscador" con ticks (retrato, ≥6 piezas, ≥3 destacadas con historia, una curada, ciudad ubicada, aceptando, guest spot próximo, Stripe conectado), cada falta enlaza a donde se arregla. Sin puntaje numérico.
- Portafolio: botón "Enviar a VANTA" por pieza publicada con imagen (nota corta), chip de estado, máximo 2 pendientes; acción `submitToVanta` en `studio/(app)/actions.ts` con `requireMember()`.
- Niveles (`src/lib/plan.ts`): `can(plan, feature)` con `feature` = `no_fee | flash | spots | magazine | submit | alerts_fanout`. **Básico**: página, galería, listado en búsqueda, inbox, cotizar y cobrar depósitos **con comisión** (`PLATFORM_FEE_BPS` aplicado en `createCheckout`). **Completo/Founding**: sin comisión + flash + guest spots fuera de casa + capítulos destacados en su revista + envíos a VANTA + avisos a seguidores. Las páginas públicas degradan bien (un artista básico tiene portada + artista + hojas de contacto). La búsqueda no favorece a quien paga. Facturación: fase 1 se fija a mano en `/admin/plans`; fase 2 agrega Stripe Billing Checkout para $22 en la cuenta plataforma (`studios.stripe_customer_id`) con endpoint aparte `/api/stripe/billing`.
- `/artists`: Básico $0 / Completo $22 / Founding (como Completo, fijo).

---

## G. Fases

### Fase 1 — Esqueleto del mundo (renombrar, buscador, ciudades, cuentas, /me)

Crear: `src/lib/{geo,search,client,alerts,plan}.ts`; `src/components/world/{WorldBar,ArtistCard,CoverPlate,SpotBadge,SaveButton,NearYou,Filters,SortChips,InstallHint,IssueCard}.tsx`; `src/app/artists/page.tsx` (landing movida); `src/app/page.tsx` (portada nueva); `src/app/explore/page.tsx` (reescrita); `src/app/city/[slug]/page.tsx`; `src/app/me/**` (layout, page, saved, briefs, briefs/[id], appointments, alerts, settings, signin + `SignInForm.tsx`, `actions.ts`); `src/app/admin/{layout,plans/page}.tsx`, `src/app/admin/actions.ts`; `supabase/migrations/0006_vanta_world.sql`, `0007_client_accounts.sql`; `tools/shots/phone.mjs` (Playwright 390×844, lista de URLs → `tools/shots/out/`, ignorado por git).

Modificar: `src/lib/brand.ts` (VANTA, `accent`, instagram, lemas), `src/components/Chrome.tsx` (wordmark), `src/app/manifest.ts`, `src/app/layout.tsx` (`%s | Vanta`), `src/lib/env.ts` (`emailFrom`, `adminEmails`, `DEMO_CLIENT_USER_ID`), `src/lib/payments.ts` (appInfo, comisión por plan), `src/lib/seed.ts`, README/CLAUDE.md/docs; borrar `src/app/explore/ExploreGate.tsx`; `src/lib/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/login/page.tsx`, `src/proxy.ts`; `src/lib/queries.ts` (`ArtistCard`, `relatedArtists`, stub `listArtistIssueAppearances`), `src/lib/catalog.ts` (`TRADES`); `src/app/studio/onboarding/actions.ts` (RESERVED, `trade`, `placeCity`), `src/app/studio/(app)/actions.ts` (`saveProfile`/`saveStop` con geo y avisos, puertas de plan), `settings/SettingsForms.tsx` + `settings/page.tsx`, `src/lib/messages.ts`; `src/app/[artist]/experience/{Deck,panels/Bio,panels/Gallery,panels/Spots,types,cities,frame}.tsx`, `src/app/[artist]/page.tsx`, `src/app/[artist]/request/{page,BriefWizard,actions,sent/page}.tsx`, `src/app/q/[token]/page.tsx`.

i18n (en.ts y es.ts, tipados juntos): `world`, `search`, `city`, `me`, `trades`, `studio.settings.discovery`, `studio.plan`, `email.spot`, `email.booksOpen`; quitar `explore.gate*` y `explore.soon`; `landing` se queda para `/artists`.

Seed: Camo e Iris + 10 artistas con estudio propio (2 más en New York, Los Angeles, Miami, Mexico City, Madrid, Barcelona, London, Berlin, Bogotá), cada uno con acento, año de inicio, bio, parada casa con zona horaria, 4–8 piezas (sin foto → `Plate`/`CoverPlate`; 2 destacadas con historia; mezcla color/curado), 1–2 guest spots en 60 días (Miami en octubre con dos visitantes), planes mezclados básico/completo. Cliente demo Daniel Reyes (`DEMO_CLIENT_USER_ID`): fila `clients` ligada, una cita pasada, 3 seguidos, 2 guardados, sigue Miami. `placeCity` en todos.

Verificación: `npm run typecheck`, `npm run lint`, `npm run build`; borrar `.data/` y arrancar; `node tools/shots/phone.mjs` para `/`, `/explore?trade=tattoo&styles=realism`, `/explore?city=miami`, `/city/miami`, `/camo`, `/me`, `/me/briefs`, `/artists`; flujos demo: buscar "realism Miami" → abrir tarjeta → Guardar (redirige a signin) → entrar como cliente demo → de vuelta en el artista queda guardado → `/me/saved` lo muestra; `/camo/request` como Daniel: contacto prellenado, enviar, `/me/briefs` lo lista; pagar `/q/…` → `/me/appointments`; estudio: lista "Lo que ve el buscador", agregar parada en Chicago → `outbox` tiene email `spot` para Daniel; Iris (básica) cotiza y el checkout lleva comisión.

### Fase 2 — VANTA: ediciones, mesa de edición, primera edición

Crear: `src/components/mag/{Mag,Chapter,Fig,Head,Fact,Stat,Stop,spreads,rules}.tsx`, `src/components/world/FlashCard.tsx`, `src/components/CopyButton.tsx` (movido del estudio), `src/lib/issue/{config,score,assemble,queries,draft}.ts`, `src/app/issue/{page,[n]/page,IssueReader,chapters}.tsx`, `src/app/issues/page.tsx`, `src/app/admin/issues/{page,[id]/page,IssueDesk}.tsx`, `src/app/admin/submissions/page.tsx`, `src/app/api/cron/issue/route.ts`, `supabase/migrations/0008_issues.sql`, `src/app/api/stripe/billing/route.ts` + `src/lib/billing.ts`.
Modificar: `Bio.tsx` (importa de `components/mag`, capítulo y sello "En VANTA"), `Flash.tsx` (usa `FlashCard`), `PortfolioManager.tsx` + acciones (`submitToVanta`), `queries.ts`, `/` y `/me` (`IssueCard`), `vercel.json` (segundo cron), `messages.ts` (`issuePublished`, `submissionDecided`), `alerts.ts`, `docs/GO-LIVE.md` (ADMIN_EMAILS, OAuth, Billing).
i18n: `issue`, `admin`, `studio.portfolio.submit*`, `email.issue`, `email.submission`.
Seed: edición No. 1 publicada (periodo últimos 30 días): portada (San Sebastián de Camo), editorial, 6 piezas de 5 artistas, despacho de Miami, calendario, flash, nuevos, colofón; un envío pendiente de Iris; No. 2 en borrador con candidatos.
Verificación: build; capturas de `/issue/1`, `/issue/1?p=…`, `/issues`, `/admin/issues/2`, `/camo#bio`; flujos: admin arma No. 3, elige 4 entradas, previsualiza, publica → `/issue` lo muestra y el outbox tiene `issue:3:*`; artista envía pieza → aparece en `/admin/submissions` → aceptar → candidata en el borrador; teclado y swipe del lector siguen funcionando en `Bio` (regresión del `Mag` extraído).

### Fase 3 — Barberos con turnos

Crear `0009_services_slots.sql`, `src/lib/slots.ts`, `src/app/[artist]/book/{page,SlotPicker,actions}.tsx`, `src/app/studio/(app)/services/{page,ServicesManager,HoursForm}.tsx`, `panels/Services.tsx`. Modificar `types.ts` (`panelsFor`), `Deck.tsx`, `ArtistExperience.tsx`, `payments.ts`, `booking.ts`, webhook (`kind`), `StudioNav`, `ArtistCard`/`SpotBadge` ("Desde $35 · 30 min"), búsqueda (`priceMax` contra servicios), i18n. Seed: dos barberos (Brooklyn, Madrid). Verificación: `/explore?trade=barber`, `/{barbero}/book`, reserva demo aparece en `/studio/bookings` y `/me/appointments`, un solapamiento lo rechaza `appointments_no_overlap`.

### Fase 4 — Murales, push, anuncios

`0010_projects.sql`, `0011_push.sql` (`push_subscriptions`), `src/app/[artist]/project/{page,ProjectWizard,actions}.tsx`, `request/shared.ts`, `public/sw.js` + `PushPrompt.tsx`, `src/lib/push.ts` (web-push con VAPID), `0012_ads.sql` (`issue_entries.kind` gana `ad`, tabla `sponsors`) y plantilla `Ad` marcada como tal. Modificar `alerts.ts` (segundo canal), `BriefView.tsx`, etiquetas de cotización, `IssueDesk` (espacio de anuncio), `panelsFor('graffiti')`.

---

## H. Riesgos y pendientes

1. **Derechos de foto**: sin casilla de consentimiento, Vanta publica lo que el artista ya publicó. Los Términos para artistas deben decir que el artista garantiza tener permiso de su cliente (texto legal pendiente de `docs/GO-LIVE.md`).
2. **Carga de edición**: mensual al inicio; 1–2 horas por número aun con el armado automático. Falta definir quién edita y en qué idioma primero (los diccionarios exigen en/es, pero el `body` de una entrada puede caer a un solo idioma).
3. **Vinculación por email**: quien reservó con un email y entra con Google con otro no ve sus briefs viejos hasta entrar con el email original. Si molesta, se agrega "reclamar por referencia + código al email".
4. **Vocabulario por oficio**: "Guest spots", "Flash", "Reservar" son palabras de tatuaje; el copy del Deck va indexado por oficio. Queda por decidir si "Guest spots" se mantiene como nombre de casa para artistas viajeros en todos los oficios.
5. **Marca**: VANTA provisional; verificar dominio y marca en USA antes de fijar; definir el handle de Instagram para `brand.ts`.

## Archivos críticos

- `src/lib/queries.ts` (ArtistCard, relacionados, apariciones en ediciones)
- `src/app/[artist]/experience/panels/Bio.tsx` (origen de `Mag`/`Ch`/`Fig`/spreads a extraer)
- `src/lib/auth.ts` + `src/app/auth/callback/route.ts` + `src/app/login/page.tsx` (sesión de cliente y admin)
- `src/app/studio/(app)/actions.ts` (geo, avisos, puertas de plan, envíos)
- `supabase/migrations/0001_core.sql` (patrones de esquema y RLS que 0006–0012 deben seguir)
