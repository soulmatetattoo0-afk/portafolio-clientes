import fs from "node:fs";
import path from "node:path";

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
  const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20 });
  type Runner = { unsafe: (text: string, params?: never[]) => Promise<unknown> };
  const make = (s: Runner, root: boolean): Raw => ({
    query: async (text, params) => (await s.unsafe(text, params as never[])) as Row[],
    tx: async (fn) => (root ? ((await sql.begin((t) => fn(make(t as unknown as Runner, false)))) as never) : fn(make(s, false))),
  });
  return wrap(make(sql as unknown as Runner, true));
}

async function connectLocal(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
  const dir = path.join(process.cwd(), ".data", "pglite");
  const fresh = !fs.existsSync(path.join(dir, "PG_VERSION"));
  fs.mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir, { extensions: { btree_gist } });
  await pg.waitReady;
  if (fresh) {
    await pg.exec(fs.readFileSync(path.join(process.cwd(), "supabase", "local-shim.sql"), "utf8"));
    const migrations = path.join(process.cwd(), "supabase", "migrations");
    for (const file of fs.readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
      await pg.exec(fs.readFileSync(path.join(migrations, file), "utf8"));
    }
  }
  type Tx = Parameters<Parameters<typeof pg.transaction>[0]>[0];
  const make = (s: typeof pg | Tx): Raw => ({
    query: async (text, params) => (await s.query<Row>(text, params)).rows,
    tx: async (fn) => ("transaction" in s ? s.transaction((t) => fn(make(t))) : fn(make(s))),
  });
  const db = wrap(make(pg));
  if (fresh) {
    const { seedDemo } = await import("./seed");
    await seedDemo(db);
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
