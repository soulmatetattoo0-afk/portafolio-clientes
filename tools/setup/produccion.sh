#!/usr/bin/env bash
# Puts VANTA's production settings into Vercel, once. Run it from the repo root:
#   bash tools/setup/produccion.sh
# It reuses the values already prepared in .env.vercel (local, never in git),
# generates the secrets that are missing, and asks you to paste the two keys
# only you can copy from Supabase. Nothing you paste is shown or saved here.
set -euo pipefail

PROJECT_URL="https://portafolio-clientes-beryl.vercel.app"
ARTIST_EMAILS="tattoo.by.sova@gmail.com,soulmate.tattoo0@gmail.com"
ADMIN="soulmate.tattoo0@gmail.com"
VERCEL="npx --yes vercel@63.1.2"

cd "$(dirname "$0")/../.."
existing="$($VERCEL env ls production 2>/dev/null || true)"

# Set one production variable, replacing it when it is already there.
put() {
  local name="$1" value="$2"
  if [ -z "$value" ]; then echo "  · $name: vacío, lo salto"; return; fi
  if grep -qE "^ *$name " <<<"$existing"; then $VERCEL env rm "$name" production -y >/dev/null 2>&1 || true; fi
  printf '%s' "$value" | $VERCEL env add "$name" production >/dev/null
  echo "  ✓ $name"
}
# Read a value from .env.vercel without printing it.
from_file() { [ -f .env.vercel ] && grep -E "^$1=" .env.vercel | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }
ask() {
  local prompt="$1" var
  printf '%s\n> ' "$prompt" >&2
  IFS= read -rs var; echo >&2
  printf '%s' "$var"
}

echo "1/3 · Ajustes de la app"
put APP_URL "$PROJECT_URL"
secret="$(from_file APP_SECRET)"; [ -n "$secret" ] || secret="$(openssl rand -hex 32)"
put APP_SECRET "$secret"
put CRON_SECRET "$(openssl rand -hex 32)"
put ADMIN_EMAILS "$ADMIN"
put ALLOWED_SIGNUPS "$ARTIST_EMAILS"
pub="$(from_file NEXT_PUBLIC_VAPID_PUBLIC_KEY)"; priv="$(from_file VAPID_PRIVATE_KEY)"
if [ -z "$pub" ] || [ -z "$priv" ]; then
  keys="$(node -e 'const w=require("web-push");const k=w.generateVAPIDKeys();console.log(k.publicKey+" "+k.privateKey)')"
  pub="${keys%% *}"; priv="${keys##* }"
fi
put NEXT_PUBLIC_VAPID_PUBLIC_KEY "$pub"
put VAPID_PRIVATE_KEY "$priv"
put VAPID_SUBJECT "mailto:$ADMIN"
if ! grep -qE "^ *NEXT_PUBLIC_SUPABASE_URL " <<<"$existing"; then put NEXT_PUBLIC_SUPABASE_URL "$(from_file NEXT_PUBLIC_SUPABASE_URL)"; fi
if ! grep -qE "^ *NEXT_PUBLIC_SUPABASE_ANON_KEY " <<<"$existing"; then put NEXT_PUBLIC_SUPABASE_ANON_KEY "$(from_file NEXT_PUBLIC_SUPABASE_ANON_KEY)"; fi

echo
echo "2/3 · Base de datos y fotos (Supabase, proyecto «vanta»)"
put DATABASE_URL "$(ask "Pega la Connection string «Transaction pooler» (con tu contraseña en lugar de [YOUR-PASSWORD]):")"
put SUPABASE_SERVICE_ROLE_KEY "$(ask "Pega la clave «service_role» (secret):")"

echo
echo "3/3 · Correos (opcional: Enter para saltar)"
resend="$(ask "Pega tu RESEND_API_KEY, o Enter para dejarlo para después:")"
if [ -n "$resend" ]; then
  put RESEND_API_KEY "$resend"
  printf 'Correo remitente, p. ej. VANTA <reservas@tudominio.com> (Enter = onboarding@resend.dev):\n> ' >&2
  IFS= read -r from
  put EMAIL_FROM "${from:-VANTA <onboarding@resend.dev>}"
fi

echo
echo "Listo. Vuelve al chat y escribe «listo»."
