import { adminOk } from "@/lib/auth";
import { DEFAULT_CONFIG, getConfig, setConfig } from "@/lib/config";
import { storageCheck } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!adminOk(req.headers.get("x-admin-password"))) return Response.json({ error: "Wrong password" }, { status: 401 });
  const [config, storage] = await Promise.all([getConfig(), storageCheck()]);
  return Response.json({
    config,
    defaults: DEFAULT_CONFIG,
    storage,
    models: {
      chat: process.env.OPENAI_MODEL || "gpt-4.1",
      builder: process.env.OPENAI_BUILDER_MODEL || process.env.OPENAI_MODEL || "gpt-4.1",
      key: !!process.env.OPENAI_API_KEY,
    },
  });
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
  try {
    await setConfig(cfg);
  } catch (e: any) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
  return Response.json({ ok: true });
}
