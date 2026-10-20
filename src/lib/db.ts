import fs from "node:fs";
import path from "node:path";

import { DEMO_DB_VERSION, demoSnapshot } from "./demo-store";
import { env } from "./env";

export type Row = Record<string, unknown>;

export interface Db {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  one<T = Row>(text: string, params?: unknown[]): Promise<T | null>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

type Raw = { query: (text: string, params: unknown[]) => Promise<Row[]>; tx: <T>(fn: (raw: Raw) => Promise<T>) => Promise<T> };

function wrap(raw: Raw): Db {
  const db: Db = {
    query: <T,>(text: string, params: unknown[] = []) => raw.query(text, params) as Promise<T[]>,
    one: async <T,>(text: string, params: unknown[] = []) => ((await raw.query(text, params))[0] as T) ?? null,
    tx: (fn) => raw.tx((inner) => fn(wrap(inner))),
  };
  return db;
}

async function connectPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  // prepare:false keeps us compatible with Supabase's transaction pooler.
  // Our queries pass JSON already stringified; postgres.js would stringify it again and store a JSON string instead of the object.
  const json = { to: 114, from: [114, 3802], serialize: (x: unknown) => (typeof x === "string" ? x : JSON.stringify(x)), parse: (x: string) => JSON.parse(x) };
  const sql = postgres(url, { prepare: false, max: Number(process.env.DATABASE_POOL_MAX ?? 5), idle_timeout: 20, onnotice: () => undefined, types: { json } });
  type Runner = { unsafe: (text: string, params?: never[]) => Promise<unknown> };
  const make = (s: Runner, root: boolean): Raw => ({
    query: async (text, params) => (await s.unsafe(text, params as never[])) as Row[],
    tx: async (fn) => (root ? ((await sql.begin((t) => fn(make(t as unknown as Runner, false)))) as never) : fn(make(s, false))),
  });
  const db = wrap(make(sql as unknown as Runner, true));
  // A brand-new database (the demo's own Postgres): build the schema and the whole demo once, under a lock so two instances never both do it.
  const empty = await db.one<{ t: string | null }>(`select to_regclass('public.studios')::text as t`);
  if (empty && empty.t === null && process.env.VANTA_DEMO === "1") {
    await sql.begin(async (t) => {
      await t.unsafe(`select pg_advisory_xact_lock(424242)`);
      const again = (await t.unsafe(`select to_regclass('public.studios')::text as t`)) as unknown as { t: string | null }[];
      if (again[0]?.t !== null) return;
      const dir = path.join(process.cwd(), "supabase");
      await t.unsafe(fs.readFileSync(path.join(dir, "local-shim.sql"), "utf8"));
      await t.unsafe(`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`);
      for (const file of fs.readdirSync(path.join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort()) {
        await t.unsafe(fs.readFileSync(path.join(dir, "migrations", file), "utf8"));
        await t.unsafe(`insert into _migrations (name) values ('${file.replace(/'/g, "")}')`);
      }
      const { seedDemo } = await import("./seed");
      await seedDemo(wrap(make(t as unknown as Runner, false)));
    });
  } else if (process.env.VANTA_DEMO === "1") {
    // A demo deployment on a database without the demo studio gets it (the demo artist, his clients and chats; nothing else). Never in production.
    const demo = await db.one(`select 1 from studios where slug = 'soulmate-tattoo'`).catch(() => undefined);
    if (demo === null) {
      const { seedDemo } = await import("./seed");
      await seedDemo(db, { world: false });
    }
  }
  return db;
}

async function connectLocal(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
  // Vercel's filesystem is read-only outside /tmp; the demo keeps its database there (per instance, reseeded on cold start).
  const dir = process.env.VERCEL ? path.join("/tmp", "brief-data", "pglite") : path.join(process.cwd(), ".data", "pglite");
  const migrations = path.join(process.cwd(), "supabase", "migrations");
  const files = fs.readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort();
  // On Vercel the demo's database is shared through Blob storage: a new instance starts from the last snapshot.
  const snapshot = demoSnapshot(`${DEMO_DB_VERSION}-${files.length}`);
  let fresh = !fs.existsSync(path.join(dir, "PG_VERSION"));
  let loadDataDir: Blob | undefined;
  if (fresh && snapshot) {
    const saved = await snapshot.pull();
    if (saved) {
      loadDataDir = saved;
      fresh = false;
    }
  }
  fs.mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir, { extensions: { btree_gist }, loadDataDir });
  await pg.waitReady;
  if (fresh) await pg.exec(fs.readFileSync(path.join(process.cwd(), "supabase", "local-shim.sql"), "utf8"));
  // Every migration runs once: a database made before a new one gets it on the next start.
  await pg.exec(`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await pg.query<{ name: string }>(`select name from _migrations`)).rows.map((r) => r.name));
  // A database from before this ledger has every migration up to its newest table; record them without rerunning.
  if (!fresh && done.size === 0) {
    const tables = new Set((await pg.query<{ t: string }>(`select table_name as t from information_schema.tables where table_schema = 'public'`)).rows.map((r) => r.t));
    for (const file of files) {
      const creates = [...fs.readFileSync(path.join(migrations, file), "utf8").matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)/gi)].map((m) => m[1]);
      if (creates.length && !creates.every((c) => tables.has(c))) break;
      await pg.query(`insert into _migrations (name) values ($1) on conflict do nothing`, [file]);
      done.add(file);
    }
  }
  for (const file of files) {
    if (done.has(file)) continue;
    await pg.exec(fs.readFileSync(path.join(migrations, file), "utf8"));
    await pg.query(`insert into _migrations (name) values ($1)`, [file]);
  }
  type Tx = Parameters<Parameters<typeof pg.transaction>[0]>[0];
  // Anything that changes a row schedules the next snapshot.
  const writes = /^\s*(insert|update|delete)\b/i;
  const changed = () => snapshot?.touch(() => pg.dumpDataDir("gzip"));
  const make = (s: typeof pg | Tx): Raw => ({
    query: async (text, params) => {
      const rows = (await s.query<Row>(text, params)).rows;
      if (writes.test(text)) changed();
      return rows;
    },
    tx: async (fn) => ("transaction" in s ? s.transaction((t) => fn(make(t))) : fn(make(s))),
  });
  const db = wrap(make(pg));
  if (fresh) {
    const { seedDemo } = await import("./seed");
    await seedDemo(db);
    changed();
  }
  return db;
}

const g = globalThis as unknown as { __db?: Promise<Db> };

/** One shared connection per server process (survives dev hot reloads). */
export function getDb(): Promise<Db> {
  if (!g.__db) {
    g.__db = (env.databaseUrl ? connectPostgres(env.databaseUrl) : connectLocal()).catch((e) => {
      g.__db = undefined;
      throw e;
    });
  }
  return g.__db;
}
