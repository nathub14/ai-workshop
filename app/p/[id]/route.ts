import { readProject, withRuntime } from "@/lib/runtime";
import { loadFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{4,20}$/.test(id)) return new Response("Not found", { status: 404 });
  const buf = await loadFile(`pages/${id}.html`);
  if (!buf) return new Response("Page not found", { status: 404 });
  const { project, html } = readProject(buf.toString("utf8"));
  const page = withRuntime(html, { project: project || id, api: new URL(req.url).origin, source: "live" });
  return new Response(page, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Kids' pages run in their own sandbox, separate from the Lab app.
      "content-security-policy": "sandbox allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox",
      "cache-control": "public, max-age=60",
    },
  });
}
