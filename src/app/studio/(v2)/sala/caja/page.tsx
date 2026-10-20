import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { loadCaja, monthNeighbours } from "@/lib/caja";
import { styleLabel } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { requestTime } from "@/lib/format";
import { getArtistById } from "@/lib/queries";
import { CajaBook, type BookMove, type ExpenseCategory } from "@/v2/CajaBook";
import { Room } from "@/v2/Room";

export const metadata = { robots: { index: false } };

/** Caja: the month's books, one month at a time. */
export default async function CajaPage({ searchParams }: PageProps<"/studio/sala/caja">) {
  const member = await requireMember();
  const sp = await searchParams;
  const [{ t, locale }, artist] = await Promise.all([getDict(), getArtistById(member.artistId)]);
  if (!artist) return null;
  const now = new Date(requestTime()).toISOString().slice(0, 7);
  const key = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) && sp.m <= now ? sp.m : now;
  const { prev, next } = monthNeighbours(key);
  const data = await loadCaja(await getDb(), member.studioId, member.artistId, key);
  const name = (k: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(new Date(`${k}-15T12:00:00Z`)).replace(".", "");
  const moves: BookMove[] = [
    ...data.pays.map((p) => ({ id: p.id, kind: p.kind, who: p.who, note: p.style ? styleLabel(p.style, locale) : null, cents: p.cents, day: p.day })),
    ...data.exps.map((e) => ({ id: e.id, kind: "expense" as const, who: e.who, note: null, cents: e.cents, day: e.day, category: e.category as ExpenseCategory })),
  ].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  return (
    <Room artist={artist} t={t} title={t.v2.room.caja}>
      <CajaBook
        month={{ key, label: name(key, { month: "long", year: "numeric" }), ...data.totals, toCollect: data.collect, prev, next: next <= now ? next : null }}
        bars={data.bars.map((b) => ({ key: b.m, label: name(b.m, { month: "short" }), income: b.income, expense: b.expense, current: b.m === key }))}
        moves={moves}
        currency={artist.currency}
        t={t}
        locale={locale}
      />
    </Room>
  );
}
