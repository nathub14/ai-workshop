import OpenAI from "openai";
import { codeOk } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { loadFile, newId, saveFile } from "@/lib/storage";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Mode = "chat" | "search" | "image" | "build";
type InMsg = { role: "user" | "assistant"; text?: string; html?: string; images?: string[] };

const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const BUILD_MODEL = process.env.OPENAI_BUILDER_MODEL || CHAT_MODEL;
const MAX_HISTORY = 20;
const MAX_USER_CHARS = 6000;
const MAX_VISION_IMAGES = 3;
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

function splitBuild(text: string): { html: string | null; note: string } {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/<!doctype html|<html[\s>]/i);
  if (start === -1) return { html: null, note: text };
  const end = body.toLowerCase().lastIndexOf("</html>");
  const html = body.slice(start, end === -1 ? body.length : end + 7).trim();
  const note = fenced ? text.replace(fenced[0], "").trim() : "";
  return { html, note };
}

async function dataUrl(path: string): Promise<string | null> {
  const m = path.match(/^\/i\/([a-z0-9]+\.(png|jpg|webp))$/);
  if (!m) return null;
  const buf = await loadFile(`images/${m[1]}`);
  return buf ? `data:${MIME[m[2]]};base64,${buf.toString("base64")}` : null;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  if (!codeOk(body.code)) return Response.json({ error: "Wrong access code" }, { status: 401 });

  const origin = new URL(req.url).origin;
  const mode: Mode = ["chat", "search", "image", "build"].includes(body.mode) ? body.mode : "chat";
  const demo = !!body.demo;
  const messages: InMsg[] = Array.isArray(body.messages) ? body.messages.slice(-MAX_HISTORY) : [];
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "No message" }, { status: 400 });
  }

  // Which pictures the AI actually gets to SEE (the rest it only gets as links).
  const uploaded = messages.flatMap((m) => (m.role === "user" ? m.images || [] : []));
  const vision = new Set(uploaded.slice(-MAX_VISION_IMAGES));
  if (mode === "image") {
    const all = messages.flatMap((m) => m.images || []);
    if (all.length) vision.add(all[all.length - 1]); // so "make it blue" edits the latest picture
  }

  let lastHtmlIdx = -1;
  messages.forEach((m, i) => {
    if (m.html) lastHtmlIdx = i;
  });

  const lastIdx = messages.length - 1;
  const input: any[] = [];
  for (const [i, m] of messages.entries()) {
    if (m.role === "user") {
      let text = String(m.text || "").slice(0, MAX_USER_CHARS);
      for (const img of m.images || []) text += `\n[Picture I uploaded: ${origin}${img}]`;
      const parts: any[] = [{ type: "input_text", text: text || "(picture)" }];
      for (const img of m.images || []) {
        if (vision.has(img)) {
          const url = await dataUrl(img);
          if (url) parts.push({ type: "input_image", image_url: url, detail: "low" });
          vision.delete(img);
        }
      }
      if (i === lastIdx) {
        // Latest generated picture, for image-edit requests
        for (const img of vision) {
          if (uploaded.includes(img)) continue;
          const url = await dataUrl(img);
          if (url) {
            parts.push({ type: "input_text", text: `[Current picture: ${origin}${img}]` });
            parts.push({ type: "input_image", image_url: url, detail: "low" });
          }
        }
      }
      input.push({ role: "user", content: parts });
    } else {
      let content = String(m.text || "");
      if (m.html) content = i === lastHtmlIdx ? "```html\n" + m.html + "\n```" : "[An earlier version of the page]";
      for (const img of m.images || []) content += `\n[Picture made: ${origin}${img}]`;
      input.push({ role: "assistant", content: content || "(no text)" });
    }
  }

  const cfg = await getConfig();
  let instructions = cfg.chatPrompt;
  if (demo) instructions += `\n\n${cfg.demoPrompt}`;
  else if (mode === "build") instructions += `\n\n${cfg.builderPrompt}`;

  const tools: any[] = [];
  if (!demo && mode === "search") tools.push({ type: "web_search" });
  if (!demo && mode === "image") tools.push({ type: "image_generation", size: "1024x1024", quality: "medium" });

  const model = mode === "build" && !demo ? BUILD_MODEL : CHAT_MODEL;
  // X-ray view for the lesson: what was really sent (pictures shortened)
  const xray = {
    model,
    instructions,
    tools,
    input: input.map((x) =>
      Array.isArray(x.content)
        ? { ...x, content: x.content.map((p: any) => (p.type === "input_image" ? { type: "input_image", image_url: "(picture data)" } : p)) }
        : x
    ),
  };

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "The AI key isn't set up yet. Tell Nathan.", xray }, { status: 500 });
  }

  try {
    const client = new OpenAI();
    const resp: any = await client.responses.create({
      model,
      instructions,
      input,
      ...(tools.length ? { tools } : {}),
    } as any);

    const images: string[] = [];
    const sources: { title: string; url: string }[] = [];
    for (const item of resp.output || []) {
      if (item.type === "image_generation_call" && item.result) {
        const id = newId(10);
        await saveFile(`images/${id}.png`, Buffer.from(item.result, "base64"), "image/png");
        images.push(`/i/${id}.png`);
      }
      if (item.type === "message") {
        for (const c of item.content || []) {
          for (const a of c.annotations || []) {
            if (a.type === "url_citation" && !sources.some((s) => s.url === a.url)) {
              sources.push({ title: a.title || a.url, url: a.url });
            }
          }
        }
      }
    }

    let text: string = resp.output_text || "";
    let html: string | null = null;
    if (mode === "build" && !demo) {
      const out = splitBuild(text);
      html = out.html;
      text = html ? out.note || "Page updated. Check the preview." : text;
    }
    if (!text && images.length) text = "Here's the picture. Download it if you want to keep it.";

    return Response.json({ text, html, images, sources, xray });
  } catch (e: any) {
    console.error(e);
    const msg =
      e?.status === 429
        ? "The AI is busy. Wait 20 seconds and try again."
        : `Something went wrong talking to the AI. Try again. (${String(e?.message || e).slice(0, 160)})`;
    return Response.json({ error: msg, xray }, { status: 500 });
  }
}
