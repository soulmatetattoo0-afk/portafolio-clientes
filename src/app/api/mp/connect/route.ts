import { getMember, getSession, requireMember } from "@/lib/auth";
import { live } from "@/lib/env";
import { authUrl } from "@/lib/mercadopago";
import { sign } from "@/lib/util";

/** "Conectar Mercado Pago": off to Mercado Pago to authorise VANTA, with a signed note of who is asking. */
export async function GET(request: Request) {
  const member = live.auth ? await getMember(await getSession()) : await requireMember();
  if (!member) return Response.redirect(new URL("/login", request.url), 303);
  if (!live.mp) return Response.redirect(new URL("/studio/sala/cobros?mp=off", request.url), 303);
  const payload = `${member.artistId}.${Math.floor(Date.now() / 1000) + 1800}`;
  return Response.redirect(authUrl(`${payload}.${sign(`mp:${payload}`)}`), 303);
}
