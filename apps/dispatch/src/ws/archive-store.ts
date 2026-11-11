import type { FastifyInstance } from "fastify";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { DispatchHub } from "./hub.js";
import type { DispatchRepo } from "../db/repository.js";
import type { RunnerRow } from "../db/schema.js";

/**
 * /app archive store — the S3 STUB. Runners zip /app at VM shutdown and
 * ship it here over their authenticated WS (vmArchive frames); resume
 * downloads it back. Swapping in real S3 means replacing store/get only —
 * the wire protocol (b64 chunks over WS) stays.
 *
 * In-memory assembly keyed by identifier; sizes are bounded by the /app
 * quota we give microvms (2GB disk, realistically far less).
 */
const assembling = new Map<string, { parts: Buffer[]; runnerId: string }>();

export function registerArchiveStore(hub: DispatchHub, repo: DispatchRepo): void {
  hub.onVmArchive(async (frame, runner) => {
    const identifier = String(frame.identifier ?? "");
    if (!identifier) return { error: "identifier required" };
    if (frame.begin) {
      assembling.set(identifier, { parts: [], runnerId: runner.id });
      return { ok: true };
    }
    const entry = assembling.get(identifier);
    if (!entry) return { error: "no archive in progress" };
    if (typeof frame.data === "string" && frame.data) {
      const chunk = Buffer.from(frame.data, "base64");
      entry.parts.push(chunk);
    }
    if (frame.done) {
      assembling.delete(identifier);
      const buf = Buffer.concat(entry.parts);
      if (entry.runnerId !== runner.id) return { error: "runner mismatch" };
      const dir = process.env.DISPATCH_ARCHIVE_DIR ?? path.join(process.cwd(), ".work", "archives");
      await fs.mkdir(path.join(dir, identifier), { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await fs.writeFile(path.join(dir, identifier, `app-${stamp}.zip`), buf);
      return { ok: true, bytes: buf.length };
    }
    return { ok: true };
  });
}

/** True when at least one archive zip exists for the identifier. */
export async function archiveExists(identifier: string): Promise<boolean> {
  return (await readLatestArchive(identifier)) !== null;
}

/** Serves the newest stored archive zip for an identifier (runner resume path). */
export async function readLatestArchive(identifier: string): Promise<Buffer | null> {
  const dir = process.env.DISPATCH_ARCHIVE_DIR ?? path.join(process.cwd(), ".work", "archives");
  try {
    const files = (await fs.readdir(path.join(dir, identifier))).filter((f) => f.endsWith(".zip")).sort();
    if (!files.length) return null;
    return await fs.readFile(path.join(dir, identifier, files[files.length - 1]));
  } catch {
    return null;
  }
}

export type { FastifyInstance, DispatchHub, DispatchRepo, RunnerRow };
