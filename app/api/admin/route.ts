import { adminOk } from "@/lib/auth";
import { DEFAULT_CONFIG, getConfig, setConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!adminOk(req.headers.get("x-admin-password"))) return Response.json({ error: "Wrong password" }, { status: 401 });
  return Response.json({ config: await getConfig(), defaults: DEFAULT_CONFIG });
}

export async function POST(req: Request) {
  if (!adminOk(req.headers.get("x-admin-password"))) return Response.json({ error: "Wrong password" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Bad request" }, { status: 400 });
  const cfg = {
    chatPrompt: String(body.chatPrompt ?? DEFAULT_CONFIG.chatPrompt),
    builderPrompt: String(body.builderPrompt ?? DEFAULT_CONFIG.builderPrompt),
    demoPrompt: String(body.demoPrompt ?? DEFAULT_CONFIG.demoPrompt),
  };
  await setConfig(cfg);
  return Response.json({ ok: true });
}
