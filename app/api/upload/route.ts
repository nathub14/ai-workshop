import { codeOk } from "@/lib/auth";
import { newId, saveFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Students upload a picture they saved earlier (the browser shrinks it first).
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form || !codeOk(form.get("code"))) return Response.json({ error: "Wrong access code" }, { status: 401 });
  const file = form.get("file");
  if (!(file instanceof Blob)) return Response.json({ error: "No file" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: "Only JPG, PNG or WEBP pictures" }, { status: 400 });
  if (file.size > 4_000_000) return Response.json({ error: "Picture too big" }, { status: 400 });
  const id = newId(10);
  try {
    await saveFile(`images/${id}.${ext}`, Buffer.from(await file.arrayBuffer()), file.type);
  } catch (e: any) {
    return Response.json({ error: String(e?.message || "Couldn't save the picture") }, { status: 500 });
  }
  return Response.json({ url: `/i/${id}.${ext}` });
}
