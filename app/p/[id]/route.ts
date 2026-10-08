import { loadFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{4,20}$/.test(id)) return new Response("Not found", { status: 404 });
  const buf = await loadFile(`pages/${id}.html`);
  if (!buf) return new Response("Page not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Kids' pages run in their own sandbox, separate from the Lab app.
      "content-security-policy": "sandbox allow-scripts allow-forms allow-modals allow-popups",
      "cache-control": "public, max-age=60",
    },
  });
}
