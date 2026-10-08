import { put, get } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";

// Saves to Vercel Blob when a store is connected, otherwise to a local .data folder.
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const localRoot = path.join(process.cwd(), ".data");

type Access = "public" | "private";
// Start with the configured access; if the store turns out to be the other kind, switch and remember.
let access: Access = process.env.BLOB_ACCESS === "public" ? "public" : "private";
const other = (a: Access): Access => (a === "public" ? "private" : "public");

function safe(p: string) {
  if (!/^[a-z]+\/[A-Za-z0-9_-]+\.[a-z]+$/.test(p)) throw new Error("bad path");
  return p;
}

export function storageMode() {
  if (useBlob) return "blob";
  if (process.env.VERCEL) return "missing";
  return "local";
}

export async function saveFile(p: string, data: string | Buffer, contentType: string) {
  safe(p);
  if (useBlob) {
    const opts = (a: Access) => ({
      access: a,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
    try {
      await put(p, data, opts(access) as any);
    } catch (e) {
      // Most common setup problem: store created as Public but app expects Private, or the reverse.
      await put(p, data, opts(other(access)) as any).catch(() => {
        throw e;
      });
      access = other(access);
    }
    return;
  }
  if (process.env.VERCEL) {
    throw new Error("Storage isn't connected. In Vercel: Storage → Create → Blob, connect it to this project, then redeploy.");
  }
  const full = path.join(localRoot, p);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

async function blobRead(p: string, a: Access): Promise<Buffer | null> {
  const res = await get(p, { access: a, useCache: false });
  if (!res) return null;
  return Buffer.from(await new Response(res.stream).arrayBuffer());
}

export async function loadFile(p: string): Promise<Buffer | null> {
  safe(p);
  if (useBlob) {
    try {
      return await blobRead(p, access);
    } catch {
      try {
        const buf = await blobRead(p, other(access));
        access = other(access);
        return buf;
      } catch {
        return null;
      }
    }
  }
  try {
    return await fs.readFile(path.join(localRoot, p));
  } catch {
    return null;
  }
}

export async function storageCheck(): Promise<{ ok: boolean; mode: string; message: string }> {
  const mode = storageMode();
  try {
    const stamp = String(Date.now());
    await saveFile("health/check.txt", stamp, "text/plain");
    const back = await loadFile("health/check.txt");
    if (back?.toString() !== stamp) return { ok: false, mode, message: "Saved a test file but couldn't read it back." };
    return {
      ok: true,
      mode,
      message: mode === "blob" ? `Vercel Blob connected (${access}).` : "Saving to the local .data folder.",
    };
  } catch (e: any) {
    return { ok: false, mode, message: String(e?.message || e) };
  }
}

export function newId(len = 8) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
