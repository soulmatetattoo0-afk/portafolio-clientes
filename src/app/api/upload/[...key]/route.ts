import { live } from "@/lib/env";
import { MAX_IMAGE_BYTES, putFile } from "@/lib/storage";
import { verifyLocalUpload } from "@/lib/uploads";

/** Local mode stand-in for Supabase signed uploads: PUT the raw file body. */
export async function PUT(request: Request, ctx: RouteContext<"/api/upload/[...key]">) {
  if (live.storage) return new Response("Not found", { status: 404 });
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  const url = new URL(request.url);
  if (!key.startsWith("drafts/") || !verifyLocalUpload(key, url.searchParams.get("exp"), url.searchParams.get("sig"))) {
    return new Response("Forbidden", { status: 403 });
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_IMAGE_BYTES) return new Response("Too large", { status: 413 });
  const data = Buffer.from(await request.arrayBuffer());
  if (data.length === 0 || data.length > MAX_IMAGE_BYTES) return new Response("Bad size", { status: 413 });
  await putFile("private", key, data, request.headers.get("content-type") ?? "application/octet-stream");
  return new Response(null, { status: 204 });
}
