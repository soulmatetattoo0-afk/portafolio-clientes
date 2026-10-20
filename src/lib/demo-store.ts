import { get, put } from "@vercel/blob";
import { waitUntil } from "@vercel/functions";

/**
 * The demo's database on Vercel, kept in one place. Every instance of the
 * app on Vercel has its own copy of the embedded database; without this,
 * what you wrote on one instance was missing on the next. So: a fresh
 * instance pulls the latest snapshot from Blob storage before it starts, and
 * every write schedules a new snapshot a moment later. One demo, one database.
 * The snapshot is keyed by the schema version: a new migration starts clean.
 */
export const DEMO_DB_VERSION = "v4";

export type Snapshot = { pull: () => Promise<Blob | null>; touch: (dump: () => Promise<Blob | File>) => void };

export function demoSnapshot(key: string): Snapshot | null {
  if (!process.env.VERCEL || !process.env.BLOB_READ_WRITE_TOKEN) return null;
  const path = `demo/pglite-${key}.tar.gz`;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  return {
    pull: async () => {
      try {
        const r = await get(path, { access: "private", useCache: false });
        if (!r || r.statusCode !== 200) return null;
        return await new Response(r.stream).blob();
      } catch {
        return null;
      }
    },
    // Writes come in bursts (one action, several rows): wait a beat, then upload once; the function stays alive until it lands.
    touch: (dump) => {
      if (timer) clearTimeout(timer);
      const done = new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          timer = null;
          chain = chain
            .then(async () => {
              const file = await dump();
              await put(path, file, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/gzip" });
            })
            .catch(() => undefined)
            .finally(resolve);
        }, 600);
      });
      try {
        waitUntil(done);
      } catch {
        /* outside a request: nothing to extend */
      }
    },
  };
}
