# VANTA · estado del proyecto y traspaso

Documento para retomar el trabajo en un chat nuevo (local o en la nube) sin perder contexto. Léelo junto con `CLAUDE.md`, `README.md` y `docs/ROADMAP-VANTA.md`.

Última actualización: octubre 2026. Rama de trabajo `claude/wonderful-clarke-e60mn7`, igual a `main`.

## Quién y cómo

- **Dueño:** Camo Contreras, tatuador de Soulmate Tattoo en New York.
- **Tono con Camo:** español latino, de tú, cercano y de confianza, como asesor de negocios y de su carrera artística.
- **Producto:** VANTA (nombre provisional elegido por Camo). Es donde encuentras a tu artista ideal, ves su obra y su revista, y reservas o cotizas según el oficio. El nombre técnico del repo sigue siendo "Brief" / `ink-brief`.

## Enlaces

| Qué | Dónde |
|---|---|
| Producción | https://portafolio-clientes-beryl.vercel.app |
| Edición No. 01 | https://portafolio-clientes-beryl.vercel.app/issue/1 |
| Perfil de Camo | https://portafolio-clientes-beryl.vercel.app/camo |
| Recorrido visual (artefacto v15) | https://claude.ai/artifact/1iGJ5nctx3mJE8Z17WzQYc |
| Plan del mundo (artefacto) | https://claude.ai/artifact/GJv8QNPnQF4wyPpvGE6gnQ |
| Repo | github.com/soulmatetattoo0-afk/portafolio-clientes |

Vercel despliega solo cada push a `main` (proyecto `portafolio-clientes`).

## Decisiones tomadas por Camo

1. Cuentas de cliente ligeras: guardar y seguir artistas, ver briefs, cotizaciones y citas, avisos.
2. Tatuaje primero; el oficio (`trade`) es de primera clase. Barberos y graffiti/murales se activan después.
3. El mundo = VANTA la revista periódica mundial + un buscador real. Mensual al inicio, semanal con volumen.
4. Web + PWA primero, tiendas después.
5. Nivel gratis cobra depósitos con comisión de Vanta. Nivel Completo a $22/mes quita la comisión y abre flash, guest spots, revista, envíos a VANTA y avisos.
6. Sin casilla de consentimiento por pieza: el artista responde por su portafolio.
7. La raíz `/` es para clientes; la página de venta a artistas está en `/artists`.
8. "Cerca de ti" solo si el usuario lo pide; nunca se guardan coordenadas.
9. En la portada dice **"Guest artists in {ciudad}"**, nunca "guest spots".
10. La revista es la protagonista: portada oficial de VANTA, fondo que cambia según la noticia, arte alrededor del mundo. Más adelante, ingresos por promociones y publicidad dentro de la revista.
11. Nunca noticias inventadas: las notas de arte son historia documentada o van selladas como "Muestra".

## Qué está construido

- **Perfil del artista** (`/[artist]`): portada, deck, revista del artista, muro, flash, reservar, guest spots con mapa de papel.
- **Brief con maniquí 3D** (`/[artist]/request`), cotización desde el estudio, depósito por Stripe Connect, citas y recordatorios.
- **Estudio del artista** (`/studio`): bandeja, cotizaciones, citas, portafolio, flash, ciudades, ajustes con "Descubrimiento" y plan.
- **Mundo de clientes (Fase 1):** portada `/`, buscador `/explore` con relajación de filtros, páginas de ciudad `/city/[slug]`, cuentas `/me` (guardados, solicitudes, sesiones, avisos, ajustes), avisos por email a seguidores, niveles y `/admin/plans`.
- **Portada para iPhone y revista (v15):**
  - `src/components/world/IssueHero.tsx`: portada oficial a pantalla completa, carrusel de noticias, fondo y acento que cambian por historia, avance cada 7 s.
  - `src/components/world/SpotTile.tsx`: franja "Guest artists in {ciudad}" (ubicación → ciudad elegida → ciudad del cliente → ciudad más grande).
  - `src/lib/issue/{types,current}.ts`: la edición No. 01 se arma en código desde la base (sin tablas todavía).
  - `src/components/mag/*`: pliegos de revista compartidos entre el perfil y la edición.
  - `src/app/issue/*`, `src/app/issues/page.tsx`: lector de la edición con 16 capítulos, enlace por capítulo y compartir.
- **Datos de demo:** Camo e Iris más 10 artistas en 10 ciudades, cliente demo Daniel Reyes. En local no hace falta ningún servicio; borrar `.data/` resiembra.

## Pendientes, en orden sugerido

1. Fotos reales para los artistas de demo (hoy muestran placa rayada o la ciudad en grande).
2. Configurar `APP_URL` en Vercel para que los enlaces de compartir usen el dominio correcto.
3. Probar en navegador "Guest artists in your city" con un cliente con sesión y ciudad propia.
4. Fase 2: tablas de ediciones, mesa de edición en `/admin/issues`, envíos de artistas a VANTA, facturación de $22 con Stripe Billing.
5. Fase 3: barberos con turnos. Fase 4: murales, notificaciones push y espacios de publicidad en la revista.
6. Arrastrados: autenticación real sin probar en vivo; tras iniciar sesión se pierde el `#deck` del enlace; páginas del estudio desbordan a 390 px.
7. Marca: verificar dominio y marca VANTA en USA antes de fijarla.

## Cómo correrlo en local

```bash
git clone https://github.com/soulmatetattoo0-afk/portafolio-clientes.git
cd portafolio-clientes
npm install
npm run dev
```

Abre http://localhost:3000. Para revisar el trabajo: `npm run typecheck`, `npm run lint` y `npm run build`.

## Reglas que no se rompen

- Todo texto visible va en `src/i18n/en.ts` y `src/i18n/es.ts`.
- Las acciones del estudio llaman `requireMember()` y filtran por `member.studioId`.
- Nunca exponer `SUPABASE_SERVICE_ROLE_KEY` al navegador; fotos de clientes solo por URL firmada.
- Nunca renumerar `ZONES` del maniquí.
- Un solo acento por pantalla; grano y halftone son clases CSS, nunca imágenes.
