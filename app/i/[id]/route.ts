import { loadFile } from "@/lib/storage";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const m = id.match(/^([a-z0-9]{4,20})\.(png|jpg|webp)$/);
  if (!m) return new Response("Not found", { status: 404 });
  const buf = await loadFile(`images/${id}`);
  if (!buf) return new Response("Image not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: { "content-type": TYPES[m[2]], "cache-control": "public, max-age=31536000, immutable" },
  });
}
