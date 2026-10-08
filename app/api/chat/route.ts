import OpenAI from "openai";
import { codeOk } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { newId, saveFile } from "@/lib/storage";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

type InMsg = { role: "user" | "assistant"; text?: string; html?: string; images?: string[] };

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const MAX_HISTORY = 16;
const MAX_USER_CHARS = 4000;

function extractHtml(text: string): string | null {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/<!doctype html|<html[\s>]/i);
  if (start === -1) return null;
  const endMatch = candidate.toLowerCase().lastIndexOf("</html>");
  const end = endMatch === -1 ? candidate.length : endMatch + 7;
  return candidate.slice(start, end).trim();
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
  const mode = {
    search: !!body.search,
    images: !!body.images,
    builder: !!body.builder,
    demo: !!body.demo,
  };
  const messages: InMsg[] = Array.isArray(body.messages) ? body.messages.slice(-MAX_HISTORY) : [];
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "No message" }, { status: 400 });
  }

  // Only keep the newest page in full; older versions are replaced to save tokens.
  let lastHtmlIdx = -1;
  messages.forEach((m, i) => {
    if (m.html) lastHtmlIdx = i;
  });

  const input = messages.map((m, i) => {
    if (m.role === "user") {
      return { role: "user" as const, content: String(m.text || "").slice(0, MAX_USER_CHARS) };
    }
    let content = String(m.text || "");
    if (m.html) content = i === lastHtmlIdx ? m.html : "[An earlier version of the web page]";
    for (const img of m.images || []) content += `\n[Image made: ${origin}${img}]`;
    return { role: "assistant" as const, content: content || "(no text)" };
  });

  const cfg = await getConfig();
  let instructions = mode.demo ? `${cfg.chatPrompt}\n\n${cfg.demoPrompt}` : cfg.chatPrompt;
  if (mode.builder) instructions += `\n\n${cfg.builderPrompt}`;

  const tools: any[] = [];
  if (!mode.builder && !mode.demo) {
    if (mode.search) tools.push({ type: "web_search" });
    if (mode.images) tools.push({ type: "image_generation", size: "1024x1024", quality: "medium" });
  }

  const xray = { model: MODEL, instructions, tools, input };

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "The AI key isn't set up yet. Tell Nathan!", xray }, { status: 500 });
  }

  try {
    const client = new OpenAI();
    const resp: any = await client.responses.create({
      model: MODEL,
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
    if (mode.builder) {
      html = extractHtml(text);
      text = html ? "Here's your page! Look at it on the right, then tell me what to change." : text;
    }
    if (!text && images.length) text = "Here's your picture!";

    return Response.json({ text, html, images, sources, xray });
  } catch (e: any) {
    console.error(e);
    const msg = e?.status === 429 ? "The AI is busy. Wait 20 seconds and try again." : "Something went wrong talking to the AI. Try again.";
    return Response.json({ error: msg, detail: String(e?.message || e), xray }, { status: 500 });
  }
}
