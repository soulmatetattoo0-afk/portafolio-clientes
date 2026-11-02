import { revalidatePath } from "next/cache";

import { getMember, getSession, requireMember } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { live } from "@/lib/env";
import { linkArtist } from "@/lib/mercadopago";
import { verify } from "@/lib/util";

/** Back from Mercado Pago: the state must be ours, fresh and for the artist signed in; then the code becomes their tokens. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (result: string) => Response.redirect(new URL(`/studio/sala/cobros?mp=${result}`, request.url), 303);
  const member = live.auth ? await getMember(await getSession()) : await requireMember();
  if (!member) return Response.redirect(new URL("/login", request.url), 303);
  const [artistId, exp, sig] = (url.searchParams.get("state") ?? "").split(".");
  const code = url.searchParams.get("code");
  if (!artistId || !exp || !sig || !verify(`mp:${artistId}.${exp}`, sig) || Number(exp) < Date.now() / 1000 || artistId !== member.artistId) return back("error");
  if (!code) return back("cancelled");
  try {
    await linkArtist(await getDb(), member.artistId, code);
  } catch (e) {
    console.error("mp link failed", e);
    return back("error");
  }
  revalidatePath("/studio", "layout");
  return back("ok");
}
