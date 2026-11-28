/**
 * Pipeline runs (ai-runner connector). A run is one synchronous pipeline execution on a runner. Toolkit is the only
 * app allowed to presign arbitrary bucket keys (gateway POST /registry/s3/presign), so it owns the run's key space:
 *
 *   - input assets are bucket keys the caller names → presigned GET urls handed to the runner;
 *   - outputs are written to presigned PUT urls the runner requests one file at a time (any number of files). Every
 *     requested path must stay inside the run's `outputPrefix`, which sits next to the reference input asset, so a
 *     pipeline can never write anywhere else in the bucket.
 *
 * Runs live in memory: the call that created one is synchronous (up to hours) and dies with the process anyway.
 */
import { randomUUID } from "node:crypto";

export interface PipelineRun {
  id: string;
  workspaceId: string;
  instanceId: string;
  pipeline: string;
  /** Always ends with "/". Every uploaded key is `outputPrefix + <relative path>`. */
  outputPrefix: string;
  startedAt: number;
  /** Keys written so far (relative path → bucket key). */
  uploads: Map<string, { key: string; contentType?: string; size?: number }>;
}

export class RunRegistry {
  private runs = new Map<string, PipelineRun>();

  create(input: Omit<PipelineRun, "id" | "startedAt" | "uploads">): PipelineRun {
    const run: PipelineRun = { ...input, id: randomUUID(), startedAt: Date.now(), uploads: new Map() };
    this.runs.set(run.id, run);
    return run;
  }

  get(id: string): PipelineRun | undefined {
    return this.runs.get(id);
  }

  finish(id: string): void {
    this.runs.delete(id);
  }
}

/** Rejects absolute paths, dot segments, NULs and empty segments. Returns the normalised relative path or null. */
export function cleanRelPath(raw: string): string | null {
  const p = String(raw ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!p || p.includes("\0") || p.length > 512) return null;
  const segs = p.split("/");
  if (segs.some((s) => s === "" || s === "." || s === "..")) return null;
  return segs.join("/");
}

/** Bucket key for a run output; null when the path escapes the run's prefix. */
export function outputKey(run: Pick<PipelineRun, "outputPrefix">, relPath: string): string | null {
  const rel = cleanRelPath(relPath);
  return rel ? `${run.outputPrefix}${rel}` : null;
}

/**
 * Where a run writes: a fresh folder next to the reference input asset —
 * `<dir of reference>/<basename>.<pipeline>-<run>/`. A fresh folder means a run can never overwrite an existing file.
 */
export function defaultOutputPrefix(referenceKey: string, pipeline: string, runId: string): string {
  const key = referenceKey.replace(/^\/+/, "");
  const slash = key.lastIndexOf("/");
  const dir = slash >= 0 ? key.slice(0, slash + 1) : "";
  const base = key.slice(slash + 1).replace(/\.[^./]+$/, "") || "asset";
  return `${dir}${base}.${pipeline}-${runId.slice(0, 8)}/`;
}

/** Validates a caller-supplied output prefix: relative, no dot segments, ends with "/". */
export function cleanPrefix(raw: string): string | null {
  const rel = cleanRelPath(String(raw).replace(/\/+$/, ""));
  return rel ? `${rel}/` : null;
}

