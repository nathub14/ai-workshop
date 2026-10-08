import { codeOk } from "@/lib/auth";
import { deleteFile, listFiles, loadFile, newId, saveFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Answers from surveys, sign-up forms and quizzes on the pages students build.
// Anyone can send an answer (classmates on their phones) and see the counts.
// Only the Lab (with the access code) sees every answer in full.

type Answer = { id: string; form: string; data: Record<string, string>; source: string; at: number };

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

// Answer files never change, so each server keeps the ones it has already read.
// The folder listing is reused for a few seconds so phones watching live results don't list storage nonstop.
const cache = new Map<string, Answer>();
const listings = new Map<string, { at: number; paths: string[] }>();
const LIST_TTL = 4000;

async function readAll(project: string): Promise<Answer[]> {
  const hit = listings.get(project);
  let paths: string[];
  if (hit && Date.now() - hit.at < LIST_TTL) paths = hit.paths;
  else {
    paths = await listFiles(`responses/${project}`);
    listings.set(project, { at: Date.now(), paths });
  }
  const missing = paths.filter((p) => !cache.has(p));
  await Promise.all(
    missing.map(async (p) => {
      const buf = await loadFile(p);
      if (!buf) return;
      try {
        cache.set(p, JSON.parse(buf.toString("utf8")));
      } catch {}
    })
  );
  return paths.flatMap((p) => cache.get(p) ?? []).sort((a, b) => a.at - b.at);
}

// Counts are public, so leave out anything that could identify someone.
const PRIVATE_KEY = /mail|phone|mobile|name|address|contact|school|birth|(^|[^a-z])age([^a-z]|$)/i;
function summarise(answers: Answer[]) {
  const fields: Record<string, Record<string, number>> = {};
  for (const a of answers) {
    for (const [k, v] of Object.entries(a.data)) {
      if (PRIVATE_KEY.test(k) || v.includes("@") || v.length > 60 || !v.trim()) continue;
      fields[k] ??= {};
      fields[k][v] = (fields[k][v] || 0) + 1;
    }
  }
  return { total: answers.length, fields };
}

function validProject(p: string) {
  return /^[a-z0-9]{4,20}$/.test(p);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
  const { project } = await ctx.params;
  if (!validProject(project)) return json({ ok: false, error: "Not found" }, 404);
  const raw = await req.text();
  if (raw.length > 10_000) return json({ ok: false, error: "Too long" }, 413);
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Bad request" }, 400);
  }
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(body?.data ?? {}).slice(0, 40)) {
    if (v == null || typeof v === "object") continue;
    data[String(k).slice(0, 80)] = String(v).slice(0, 1000);
  }
  const answer: Answer = {
    id: newId(10),
    form: String(body?.form || "form").slice(0, 60),
    data,
    source: body?.source === "preview" ? "preview" : "live",
    at: Date.now(),
  };
  const p = `responses/${project}/${answer.at.toString(36)}${answer.id}.json`;
  try {
    await saveFile(p, JSON.stringify(answer), "application/json");
  } catch (e: any) {
    console.error(e);
    return json({ ok: false, error: "Couldn't save" }, 500);
  }
  cache.set(p, answer);
  listings.get(project)?.paths.push(p);
  return json({ ok: true });
}

export async function GET(req: Request, ctx: { params: Promise<{ project: string }> }) {
  const { project } = await ctx.params;
  if (!validProject(project)) return json({ error: "Not found" }, 404);
  const url = new URL(req.url);
  let answers = await readAll(project).catch(() => [] as Answer[]);
  if (url.searchParams.get("summary")) {
    const form = url.searchParams.get("form");
    if (form) answers = answers.filter((a) => a.form === form);
    return json(summarise(answers));
  }
  if (!codeOk(req.headers.get("x-lab-code"))) return json({ error: "Wrong access code" }, 401);
  return json({ answers });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ project: string }> }) {
  const { project } = await ctx.params;
  if (!validProject(project)) return json({ error: "Not found" }, 404);
  if (!codeOk(req.headers.get("x-lab-code"))) return json({ error: "Wrong access code" }, 401);
  const paths = await listFiles(`responses/${project}`);
  await Promise.all(paths.map((p) => deleteFile(p).then(() => cache.delete(p))));
  listings.delete(project);
  return json({ ok: true });
}
