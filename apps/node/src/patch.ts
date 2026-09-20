import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config";
import { post } from "./http";
import type { TwodbAgentEvent } from "@twodb/contracts";

const sha256 = (content: string): string => createHash("sha256").update(content, "utf8").digest("hex");

const safeResolve = (relative: string): string => {
  const root = path.resolve(config.rootDir);
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("path_outside_root");
  }
  return target;
};

type PatchEvent = Extract<TwodbAgentEvent, { kind: "patch" }>;

export async function applyPatch(event: PatchEvent): Promise<void> {
  try {
    const target = safeResolve(event.path);
    let content = "";
    try {
      content = await fs.readFile(target, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    if (event.base_hash != null && event.base_hash !== sha256(content)) {
      throw new Error("base_mismatch");
    }

    const lines = content === "" ? [] : content.split("\n");
    for (const op of [...event.ops].sort((a, b) => b.start - a.start)) {
      lines.splice(op.start, op.delete_count, ...op.lines);
    }

    const next = lines.join("\n");
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, next, "utf8");
    await post(`/agent/patches/${event.id}/result`, { ok: true, hash: sha256(next) });
  } catch (error) {
    await post(`/agent/patches/${event.id}/result`, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
