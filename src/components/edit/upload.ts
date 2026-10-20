import type { UploadTarget } from "@/lib/uploads";

export type Storage = { url: string; anonKey: string } | null;
type Prepared = { token: string; targets: UploadTarget[] } | null;

/**
 * Browser → storage: ask the server for one signed target per file, put each
 * file there, and hand back the draft token with the keys that went up.
 */
export async function uploadFiles(prepare: (meta: { type: string; size: number }[]) => Promise<Prepared>, files: File[], storage: Storage): Promise<{ token: string; keys: string[] } | null> {
  if (!files.length) return null;
  const prepared = await prepare(files.map((f) => ({ type: f.type, size: f.size })));
  if (!prepared) return null;
  const supabase = storage ? (await import("@supabase/supabase-js")).createClient(storage.url, storage.anonKey) : null;
  const keys: string[] = [];
  await Promise.all(
    prepared.targets.map(async (target, i) => {
      const file = files[i];
      if (supabase && target.token && target.bucket) {
        const { error } = await supabase.storage.from(target.bucket).uploadToSignedUrl(target.key, target.token, file, { contentType: file.type });
        if (error) throw error;
      } else if (target.url) {
        const res = await fetch(target.url, { method: "PUT", body: file, headers: { "content-type": file.type } });
        if (!res.ok) throw new Error("upload failed");
      }
      keys.push(target.key);
    }),
  );
  return { token: prepared.token, keys };
}
