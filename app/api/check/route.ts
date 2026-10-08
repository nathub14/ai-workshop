import { codeOk } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return Response.json({ ok: codeOk(body.code) });
}
