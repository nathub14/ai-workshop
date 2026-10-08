import { put, get } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";

// Saves to Vercel Blob when a store is connected, otherwise to a local .data folder.
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const access = (process.env.BLOB_ACCESS === "public" ? "public" : "private") as "public" | "private";
const localRoot = path.join(process.cwd(), ".data");

function safe(p: string) {
  if (!/^[a-z]+\/[A-Za-z0-9_-]+\.[a-z]+$/.test(p)) throw new Error("bad path");
  return p;
}

export async function saveFile(p: string, data: string | Buffer, contentType: string) {
  safe(p);
  if (useBlob) {
    await put(p, data, {
      access,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
    return;
  }
  const full = path.join(localRoot, p);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function loadFile(p: string): Promise<Buffer | null> {
  safe(p);
  if (useBlob) {
    try {
      const res = await get(p, { access, useCache: false });
      if (!res) return null;
      return Buffer.from(await new Response(res.stream).arrayBuffer());
    } catch {
      return null;
    }
  }
  try {
    return await fs.readFile(path.join(localRoot, p));
  } catch {
    return null;
  }
}

export function newId(len = 8) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
