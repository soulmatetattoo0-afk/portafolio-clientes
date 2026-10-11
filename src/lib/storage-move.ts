import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { env, live } from "./env";
import { mediaKind, putFile, readLocalFile, removeFile } from "./storage";
import { sign } from "./util";

/** Move an uploaded draft (private bucket) into the public portfolio bucket. Returns the new key. */
export async function moveDraftToPublic(draftKey: string, prefix: string): Promise<string> {
  const name = path.posix.basename(draftKey);
  const key = `${prefix}/${name}`;
  let data: Buffer | null;
  if (live.storage) {
    const admin = createClient(env.supabaseUrl!, env.supabaseServiceKey!, { auth: { persistSession: false } });
    const { data: blob, error } = await admin.storage.from("brief-files").download(draftKey);
    if (error || !blob) throw new Error(`Move failed: ${error?.message}`);
    data = Buffer.from(await blob.arrayBuffer());
  } else {
    const exp = String(Math.floor(Date.now() / 1000) + 60);
    data = await readLocalFile("private", draftKey, exp, sign(`private/${draftKey}:${exp}`));
  }
  if (!data) throw new Error("Move failed: missing draft");
  await putFile("public", key, data, mediaKind(data)?.mime ?? "image/jpeg");
  await removeFile("private", draftKey).catch(() => undefined);
  return key;
}
