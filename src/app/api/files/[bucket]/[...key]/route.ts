import { live } from "@/lib/env";
import { mediaKind, readLocalFile } from "@/lib/storage";

/** Local mode file server. Private files need the signature from fileUrl(). Videos answer byte ranges, which Safari needs to play them. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[bucket]/[...key]">) {
  if (live.storage) return new Response("Not found", { status: 404 });
  const { bucket, key: parts } = await ctx.params;
  if (bucket !== "public" && bucket !== "private") return new Response("Not found", { status: 404 });
  const key = parts.map(decodeURIComponent).join("/");
  const url = new URL(request.url);
  const data = await readLocalFile(bucket, key, url.searchParams.get("exp"), url.searchParams.get("sig"));
  if (!data) return new Response("Not found", { status: 404 });
  const kind = mediaKind(data);
  const headers: Record<string, string> = {
    "content-type": kind?.mime ?? "application/octet-stream",
    "cache-control": bucket === "public" ? "public, max-age=3600" : "private, max-age=600",
    "x-content-type-options": "nosniff",
    "accept-ranges": "bytes",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = data.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(data), { headers });
}
