import { loadFile } from "@/lib/storage";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{4,20}\.png$/.test(id)) return new Response("Not found", { status: 404 });
  const buf = await loadFile(`images/${id}`);
  if (!buf) return new Response("Image not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" },
  });
}
