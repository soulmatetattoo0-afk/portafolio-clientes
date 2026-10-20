import type { Db } from "./db";

/**
 * The artist's books for one month: what the app collected (deposits and
 * session balances, net of VANTA's fee), what they spent, six months of
 * bars, and the sessions done but not paid yet. Seeded demo payments never
 * count, so a new account starts at zero.
 */
export async function loadCaja(db: Db, studioId: string, artistId: string, monthKey: string) {
  const start = `${monthKey}-01`;
  const net = `(p.amount_cents - coalesce(p.application_fee_cents, 0))`;
  const real = `p.studio_id = $1 and p.status = 'paid' and p.checkout_id not like 'demo_seed_%'`;
  const [totals, bars, pays, exps, collect] = await Promise.all([
    db.one<{ income: number; deposits: number; sessions: number; expenses: number }>(
      `select coalesce((select sum(${net}) from payments p where ${real} and date_trunc('month', p.created_at) = $3::date), 0)::int as income,
              coalesce((select sum(${net}) from payments p where ${real} and p.kind = 'deposit' and date_trunc('month', p.created_at) = $3::date), 0)::int as deposits,
              coalesce((select sum(${net}) from payments p where ${real} and p.kind = 'balance' and date_trunc('month', p.created_at) = $3::date), 0)::int as sessions,
              coalesce((select sum(e.amount_cents) from expenses e where e.artist_id = $2 and date_trunc('month', e.day::timestamp) = $3::date), 0)::int as expenses`,
      [studioId, artistId, start],
    ),
    db.query<{ m: string; income: number; expense: number }>(
      `select to_char(d, 'YYYY-MM') as m,
              coalesce((select sum(${net}) from payments p where ${real} and date_trunc('month', p.created_at) = d), 0)::int as income,
              coalesce((select sum(e.amount_cents) from expenses e where e.artist_id = $2 and date_trunc('month', e.day::timestamp) = d), 0)::int as expense
         from generate_series($3::date - interval '5 months', $3::date, interval '1 month') as d order by d`,
      [studioId, artistId, start],
    ),
    db.query<{ id: string; kind: "deposit" | "balance"; cents: number; day: string; who: string; style: string | null }>(
      `select p.id, p.kind, ${net}::int as cents, to_char(p.created_at, 'YYYY-MM-DD') as day, c.name as who, b.style
         from payments p join quotes q on q.id = p.quote_id join briefs b on b.id = q.brief_id join clients c on c.id = b.client_id
        where ${real} and date_trunc('month', p.created_at) = $2::date order by p.created_at desc`,
      [studioId, start],
    ),
    db.query<{ id: string; cents: number; day: string; who: string; category: string }>(
      `select id, amount_cents as cents, to_char(day, 'YYYY-MM-DD') as day, label as who, category from expenses
        where artist_id = $1 and date_trunc('month', day::timestamp) = $2::date order by day desc, created_at desc`,
      [artistId, start],
    ),
    db.one<{ n: number; cents: number }>(
      `select count(*)::int as n, coalesce(sum(ap.balance_cents), 0)::int as cents from appointments ap
        where ap.studio_id = $1 and ap.status in ('confirmed', 'completed') and ap.starts_at < now() and ap.brief_id is not null
          and not exists (select 1 from payments p where p.appointment_id = ap.id and p.kind = 'balance' and p.status = 'paid')`,
      [studioId],
    ),
  ]);
  return { totals: totals ?? { income: 0, deposits: 0, sessions: 0, expenses: 0 }, bars, pays, exps, collect: collect ?? { n: 0, cents: 0 } };
}

/** "2026-10" → its neighbours. */
export function monthNeighbours(key: string) {
  const [y, m] = key.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  return { prev, next };
}
