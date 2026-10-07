import { live } from "@/lib/env";
import { imageKind, readLocalFile } from "@/lib/storage";

/** Local mode file server. Private files need the signature from fileUrl(). */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[bucket]/[...key]">) {
  if (live.storage) return new Response("Not found", { status: 404 });
  const { bucket, key: parts } = await ctx.params;
  if (bucket !== "public" && bucket !== "private") return new Response("Not found", { status: 404 });
  const key = parts.map(decodeURIComponent).join("/");
  const url = new URL(request.url);
  const data = await readLocalFile(bucket, key, url.searchParams.get("exp"), url.searchParams.get("sig"));
  if (!data) return new Response("Not found", { status: 404 });
  const kind = imageKind(data, "");
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": kind?.mime ?? "application/octet-stream",
      "cache-control": bucket === "public" ? "public, max-age=3600" : "private, max-age=600",
      "x-content-type-options": "nosniff",
    },
  });
}
