import { codeOk } from "@/lib/auth";
import { newId, saveFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!codeOk(body.code)) return Response.json({ error: "Wrong access code" }, { status: 401 });
  const html = String(body.html || "");
  if (!html || html.length > 1_000_000) return Response.json({ error: "No page to share" }, { status: 400 });
  const id = newId(8);
  try {
    await saveFile(`pages/${id}.html`, html, "text/html; charset=utf-8");
  } catch (e: any) {
    console.error(e);
    return Response.json({ error: String(e?.message || "Couldn't save the page") }, { status: 500 });
  }
  const origin = new URL(req.url).origin;
  return Response.json({ id, url: `${origin}/p/${id}` });
}
