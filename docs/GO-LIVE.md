# Salir a producción

Pasos para pasar del modo demo a un sistema real con tus primeros artistas en Nueva York. Calcula unas 2 horas la primera vez.

## 1. Supabase (base de datos, login y archivos)

1. Crea un proyecto en supabase.com, en la región **East US** (más cerca de Nueva York).
2. En **SQL Editor**, ejecuta en orden `supabase/migrations/0001_core.sql` y `supabase/migrations/0002_storage.sql`. La segunda crea los buckets `portfolio` (público) y `brief-files` (privado).
3. En **Authentication → URL Configuration**, pon tu dominio en *Site URL* y agrega `https://tudominio.com/auth/callback` en *Redirect URLs*.
4. En **Authentication → Emails**, conecta el SMTP de Resend (paso 3) para que los links de acceso no salgan con el remitente genérico de Supabase.
5. Copia a tus variables de entorno:
   - `DATABASE_URL`: **Connect → Transaction pooler** (puerto 6543).
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`: **Project Settings → API**. La service role nunca va al navegador.

## 2. Stripe (depósitos)

1. En tu cuenta de Stripe, activa **Connect** y elige que los artistas usen cuentas **Standard**: cada artista es dueño de su cuenta, ve sus pagos y gestiona sus disputas.
2. Copia `STRIPE_SECRET_KEY`. Empieza con la clave de prueba (`sk_test_...`).
3. En **Developers → Webhooks**, crea un endpoint `https://tudominio.com/api/stripe/webhook`, marcado como **"Events on Connected accounts"**, con estos eventos:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
   - `account.updated`
4. Copia el *signing secret* a `STRIPE_WEBHOOK_SECRET`.
5. Cada artista conecta su Stripe desde **Ajustes → Pagos**. Hasta que lo haga, sus cotizaciones no se pueden pagar.

`PLATFORM_FEE_BPS` cobra una comisión sobre cada depósito (300 = 3%). Déjala en 0 mientras cobres mensualidad.

## 3. Resend (correos)

1. Crea una cuenta en resend.com y verifica tu dominio (registros DNS).
2. Copia `RESEND_API_KEY` y define `EMAIL_FROM`, por ejemplo `Brief <reservas@tudominio.com>`.
3. Las respuestas de los clientes a una cotización o a una pregunta van directo al email del artista (`reply-to`).

## 4. Vercel (hosting)

1. Importa el repositorio en Vercel.
2. Carga todas las variables de `.env.example`. Para `APP_SECRET` y `CRON_SECRET` usa cadenas largas al azar (`openssl rand -base64 32`).
3. `APP_URL` debe ser tu dominio final, sin `/` al final.
4. `vercel.json` programa `/api/cron/outbox` una vez al día, que es lo que permite el plan Hobby. Ese cron envía los recordatorios y libera fechas apartadas que no se pagaron.
   - En plan Pro, cámbialo a cada hora (`0 * * * *`) para que los recordatorios salgan más puntuales.
   - Los correos de confirmación no dependen del cron: salen en el momento.

## 5. Primer artista

1. El artista entra a `/login` con su email, recibe el link y crea su página.
2. En **Ajustes**: perfil, estilos, precio mínimo, reglas del depósito y conexión con Stripe.
3. En **Ciudades**: estudio base y guest spots.
4. En **Portafolio**: sus mejores 10 a 15 piezas, marcando las curadas.
5. Pone el link de su página en la bio de Instagram. Si viene de anuncios, agrega UTMs (`?utm_source=meta&utm_campaign=...`) y quedan guardados en cada brief.

## Antes de abrir al público

- Pon **Cloudflare Turnstile** en el formulario del brief. Hoy hay un límite de envíos por IP en memoria, que solo frena abusos casuales.
- Haz una reserva real de punta a punta con tarjeta de prueba de Stripe (`4242 4242 4242 4242`) y revisa que lleguen los cuatro correos: brief recibido, cotización, confirmación y aviso al artista.
- Escribe los textos legales: términos, privacidad y la política de depósito que cada artista configura. Las fotos de clientes son datos sensibles: el bucket privado y las URLs firmadas ya están, pero el aviso de privacidad lo tienes que redactar tú.
