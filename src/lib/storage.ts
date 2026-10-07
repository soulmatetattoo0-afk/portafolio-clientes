import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { env, live } from "./env";
import { sign, verify } from "./util";

/** "public" holds portfolio photos; "private" holds client uploads (bodies, references). */
export type Bucket = "public" | "private";

const BUCKET_NAMES: Record<Bucket, string> = { public: "portfolio", private: "brief-files" };
const LOCAL_ROOT = path.join(process.cwd(), ".data", "files");

const admin = () => createClient(env.supabaseUrl!, env.supabaseServiceKey!, { auth: { persistSession: false } });

export async function putFile(bucket: Bucket, key: string, data: Buffer, contentType: string) {
  if (live.storage) {
    const { error } = await admin().storage.from(BUCKET_NAMES[bucket]).upload(key, data, { contentType, upsert: false });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return;
  }
  const file = localPath(bucket, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

export async function removeFile(bucket: Bucket, key: string) {
  if (live.storage) {
    await admin().storage.from(BUCKET_NAMES[bucket]).remove([key]);
    return;
  }
  await fs.rm(localPath(bucket, key), { force: true });
}

/** A URL the browser can load. Private files get a short-lived signature. */
export async function fileUrl(bucket: Bucket, key: string, expiresIn = 3600): Promise<string> {
  if (live.storage) {
    const store = admin().storage.from(BUCKET_NAMES[bucket]);
    if (bucket === "public") return store.getPublicUrl(key).data.publicUrl;
    const { data, error } = await store.createSignedUrl(key, expiresIn);
    if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`);
    return data.signedUrl;
  }
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  if (bucket === "public") return `/api/files/public/${encoded}`;
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  return `/api/files/private/${encoded}?exp=${exp}&sig=${sign(`private/${key}:${exp}`)}`;
}

export async function fileUrls(bucket: Bucket, keys: string[]) {
  return Promise.all(keys.map((k) => fileUrl(bucket, k)));
}

/** Local mode: resolve and authorise a request to /api/files/... */
export async function readLocalFile(bucket: Bucket, key: string, exp?: string | null, sig?: string | null) {
  if (bucket === "private") {
    const e = Number(exp);
    if (!sig || !e || e < Date.now() / 1000 || !verify(`private/${key}:${e}`, sig)) return null;
  }
  try {
    return await fs.readFile(localPath(bucket, key));
  } catch {
    return null;
  }
}

function localPath(bucket: Bucket, key: string) {
  const root = path.join(LOCAL_ROOT, bucket);
  const file = path.normalize(path.join(root, key));
  if (!file.startsWith(root + path.sep)) throw new Error("Invalid file key");
  return file;
}

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Validate an uploaded image by its magic bytes, not just the browser's claim. */
export function imageKind(data: Buffer, claimed: string): { mime: string; ext: string } | null {
  const sniff = (): string | null => {
    if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
    if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP") return "image/webp";
    if (data.subarray(0, 3).toString() === "GIF") return "image/gif";
    const brand = data.subarray(4, 12).toString();
    if (brand.startsWith("ftyp") && /heic|heix|mif1|msf1|hevc/.test(brand + data.subarray(12, 24).toString())) {
      return claimed === "image/heif" ? "image/heif" : "image/heic";
    }
    return null;
  };
  const mime = sniff();
  return mime ? { mime, ext: IMAGE_TYPES[mime] } : null;
}
