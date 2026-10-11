import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { env, live } from "./env";
import { imageKind, isVideoKey, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VIDEO_TYPES, videoKind } from "./storage";
import { sign, verify } from "./util";

/**
 * Client files go straight from the browser to storage (Vercel caps request
 * bodies at 4.5 MB, so they can't pass through a server action). The server
 * hands out one signed upload target per file under drafts/<draftId>/, then
 * accepts only those keys when the brief is submitted.
 */

export type UploadKind = "reference" | "skin" | "placement" | "media";
export const MAX_REFERENCES = 8;

export interface UploadTarget<K extends UploadKind = UploadKind> {
  key: string;
  kind: K;
  /** Local mode: PUT the raw file here. */
  url?: string;
  /** Live mode: supabase-js uploadToSignedUrl(path, token, file). */
  token?: string;
  bucket?: string;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  ...VIDEO_TYPES,
};

export function draftToken(draftId: string) {
  const exp = Math.floor(Date.now() / 1000) + 2 * 3600;
  return `${draftId}.${exp}.${sign(`draft:${draftId}:${exp}`)}`;
}

export function readDraftToken(token: string): string | null {
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
  return verify(`draft:${id}:${exp}`, sig) ? id : null;
}

export async function createUploadTargets<K extends UploadKind>(files: { kind: K; type: string; size: number }[]) {
  const draftId = randomUUID();
  const targets: UploadTarget<K>[] = [];
  for (const f of files) {
    const ext = EXT[f.type] ?? "jpg";
    const key = `drafts/${draftId}/${f.kind}-${randomUUID().slice(0, 8)}.${ext}`;
    if (live.storage) {
      const admin = createClient(env.supabaseUrl!, env.supabaseServiceKey!, { auth: { persistSession: false } });
      const { data, error } = await admin.storage.from("brief-files").createSignedUploadUrl(key);
      if (error || !data) throw new Error(`Upload target failed: ${error?.message}`);
      targets.push({ key, kind: f.kind, token: data.token, bucket: "brief-files" });
    } else {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      targets.push({ key, kind: f.kind, url: `/api/upload/${key}?exp=${exp}&sig=${sign(`upload:${key}:${exp}`)}` });
    }
  }
  return { draftId, token: draftToken(draftId), targets };
}

export function verifyLocalUpload(key: string, exp: string | null, sig: string | null) {
  const e = Number(exp);
  return Boolean(sig && e && e > Date.now() / 1000 && verify(`upload:${key}:${e}`, sig));
}

/** Confirm a submitted key really sits in this draft and holds an image; returns its mime and size. */
export async function inspectUpload(draftId: string, key: string, opts: { video?: boolean } = {}): Promise<{ mime: string; bytes: number } | null> {
  if (!key.startsWith(`drafts/${draftId}/`) || key.includes("..")) return null;
  // Videos only where the caller allows them (the magazine), and only under a video name.
  const check = (buf: Buffer, claimed: string) => {
    if (opts.video && isVideoKey(key)) {
      const v = videoKind(buf);
      return v && buf.length <= MAX_VIDEO_BYTES ? v : null;
    }
    const k = imageKind(buf, claimed);
    return k && buf.length <= MAX_IMAGE_BYTES ? k : null;
  };
  if (live.storage) {
    const admin = createClient(env.supabaseUrl!, env.supabaseServiceKey!, { auth: { persistSession: false } });
    const { data, error } = await admin.storage.from("brief-files").download(key);
    if (error || !data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    const kind = check(buf, data.type);
    if (!kind) {
      await admin.storage.from("brief-files").remove([key]);
      return null;
    }
    return { mime: kind.mime, bytes: buf.length };
  }
  const { readLocalFile } = await import("./storage");
  const exp = String(Math.floor(Date.now() / 1000) + 60);
  const buf = await readLocalFile("private", key, exp, sign(`private/${key}:${exp}`));
  if (!buf) return null;
  const kind = check(buf, "");
  return kind ? { mime: kind.mime, bytes: buf.length } : null;
}
