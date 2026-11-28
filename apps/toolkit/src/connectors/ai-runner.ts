/**
 * AI Runner connector. One instance = one Dispatch runner started with `--pipelines` (the ai-pipelines capability).
 * Every pipeline that runner advertises becomes a command, i.e. an agent tool `<instance>_<pipeline>`; the command list
 * is resolved per instance from the runner's `hello` (so a runner with GPU pipelines exposes more tools than a laptop).
 *
 * Assets never travel through toolkit or dispatch as bytes:
 *   - asset params are storage keys of the install's bucket → toolkit presigns GET urls → the runner downloads them;
 *   - the runner uploads each output file to a presigned PUT url it requests through the run (see runs.ts), written to a
 *     fresh folder next to the first input asset (or `outputPrefix`); the response lists every written file.
 */
import type { ConnectorTemplate, ConnectorCommand, ConnectorHost } from "./types.js";
import { cleanPrefix, defaultOutputPrefix } from "../runs.js";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const RESULT_URL_TTL_S = 6 * 3600;

interface PipelineParam { type: string; description: string; required?: boolean; options?: string[] }
interface Pipeline { id: string; version?: string; description: string; gpu?: boolean; params: Record<string, PipelineParam> }
interface RunnerPipelines { runnerId: string; runnerName: string; gpu: string | null; pipelines: Pipeline[] }

async function listRunnerPipelines(host: ConnectorHost): Promise<RunnerPipelines[]> {
  const res = await host.callApp("dispatch", "/api/pipelines");
  if (res.status !== 200 || !Array.isArray(res.body)) throw new Error(`dispatch /pipelines answered ${res.status}${res.body?.error ? `: ${res.body.error}` : ""}`);
  return res.body as RunnerPipelines[];
}

const isAsset = (p: PipelineParam) => p.type === "asset" || p.type === "assets";

/** A bucket key, or an http(s) url passed through untouched. */
const isUrl = (v: string) => /^https?:\/\//i.test(v);

function assetKeys(value: unknown, param: string): string[] {
  let v = value;
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("[")) { try { v = JSON.parse(t); } catch { /* single key that happens to start with [ */ } }
  }
  const list = Array.isArray(v) ? v : [v];
  const keys = list.map((x) => String(x ?? "").trim().replace(/^\/+/, "")).filter(Boolean);
  if (keys.length === 0) throw Object.assign(new Error(`parameter "${param}" needs at least one storage key`), { status: 400 });
  return keys;
}

export const aiRunnerTemplate: ConnectorTemplate = {
  id: "ai-runner",
  name: "AI Runner",
  description: "Runs AI pipelines (video → frames, OCR, transcription, document → markdown …) on a GPU/CPU runner. Assets are storage keys; results are written next to the input.",
  icon: "cpu",
  fields: [
    { key: "runner", label: "Runner", type: "select", required: true, help: "A Dispatch runner started with --pipelines. Its pipelines become this connector's tools." },
  ],
  commands: [],
  broadcasts: [],

  async healthCheck(config) {
    if (!config.runner?.trim()) throw new Error("select a runner");
  },

  async fieldOptions(key, host) {
    if (key !== "runner") return [];
    const runners = await listRunnerPipelines(host);
    return runners.map((r) => ({
      value: r.runnerName,
      label: `${r.runnerName}${r.gpu ? ` · ${r.gpu}` : ""} · ${r.pipelines.length} pipeline${r.pipelines.length === 1 ? "" : "s"}`,
    }));
  },

  async resolveCommands(config, host) {
    const runner = (await listRunnerPipelines(host)).find((r) => r.runnerName === config.runner);
    if (!runner) return [];
    return runner.pipelines.map((p): ConnectorCommand => {
      const params: ConnectorCommand["params"] = {};
      for (const [k, spec] of Object.entries(p.params ?? {})) {
        params[k] = {
          type: spec.type === "asset" || spec.type === "assets" || spec.type === "number" || spec.type === "boolean" || spec.type === "enum" || spec.type === "date" ? (spec.type as any) : "string",
          description: isAsset(spec) ? `${spec.description} (storage key${spec.type === "assets" ? "s — an array" : ""})` : spec.description,
          ...(spec.required ? { required: true } : {}),
          ...(spec.options ? { options: spec.options } : {}),
        };
      }
      params.outputPrefix = { type: "string", description: "Optional storage folder for the results. Default: a new folder next to the first input asset." };
      return { name: p.id, description: `${p.description}${p.gpu ? " (GPU)" : ""} Runs on "${runner.runnerName}"; returns {output, files:[{path,key,url}], outputPrefix}.`, params };
    });
  },

  async execute(command, params, rt) {
    const host = rt.host;
    if (!host) throw Object.assign(new Error("platform not connected"), { status: 503 });
    const runnerName = rt.config.runner;
    const runner = (await listRunnerPipelines(host)).find((r) => r.runnerName === runnerName);
    if (!runner) throw Object.assign(new Error(`runner "${runnerName}" is offline or no longer offers pipelines`), { status: 409 });
    const pipeline = runner.pipelines.find((p) => p.id === command);
    if (!pipeline) throw Object.assign(new Error(`runner "${runnerName}" has no pipeline "${command}"`), { status: 404 });

    // split params: assets (storage keys → presigned GET) vs plain
    const plain: Record<string, unknown> = {};
    const assetSpecs: Array<{ param: string; keys: string[] }> = [];
    for (const [k, spec] of Object.entries(pipeline.params ?? {})) {
      const v = params[k];
      if (v === undefined || v === null || v === "") continue;
      if (isAsset(spec)) assetSpecs.push({ param: k, keys: assetKeys(v, k) });
      else plain[k] = v;
    }

    const reference = assetSpecs.flatMap((a) => a.keys).find((k) => !isUrl(k));
    const requestedPrefix = params.outputPrefix ? cleanPrefix(String(params.outputPrefix)) : null;
    if (params.outputPrefix && !requestedPrefix) throw Object.assign(new Error("outputPrefix must be a relative storage folder without dot segments"), { status: 400 });
    if (!requestedPrefix && !reference) throw Object.assign(new Error("no input asset to place results next to — pass outputPrefix"), { status: 400 });

    // presign inputs in one call
    const toSign = assetSpecs.flatMap((a) => a.keys.filter((k) => !isUrl(k)).map((key) => ({ method: "GET" as const, key, expiresIn: 6 * 3600 })));
    const signed = toSign.length ? await host.presign(toSign) : [];
    const urlOf = new Map(signed.map((s) => [s.key, s.url]));
    const assets: Record<string, unknown> = {};
    for (const a of assetSpecs) {
      const refs = a.keys.map((k) => ({ url: isUrl(k) ? k : urlOf.get(k)!, name: decodeURIComponent((isUrl(k) ? new URL(k).pathname : k).split("/").pop() || "asset") }));
      assets[a.param] = pipeline.params[a.param]!.type === "assets" || refs.length > 1 ? refs : refs[0];
    }

    const run = host.runs.create({ workspaceId: host.workspaceId, instanceId: host.instanceId, pipeline: command, outputPrefix: "" });
    run.outputPrefix = requestedPrefix ?? defaultOutputPrefix(reference!, command, run.id);
    try {
      const res = await host.callApp("dispatch", "/api/pipelines/run", {
        body: { runnerId: runnerName, pipeline: command, runId: run.id, params: plain, assets, timeoutMs: FOUR_HOURS_MS },
        timeoutMs: FOUR_HOURS_MS + 15 * 60_000,
      });
      if (res.status !== 200) {
        const tail = typeof res.body?.stderr === "string" && res.body.stderr ? `\n${String(res.body.stderr).slice(-1500)}` : "";
        throw Object.assign(new Error(`${res.body?.error ?? `dispatch answered ${res.status}`}${tail}`), { status: res.status === 422 ? 502 : res.status });
      }
      const files = (res.body.files ?? []) as Array<{ path: string; size: number; contentType: string }>;
      const getOps = files.map((f) => ({ method: "GET" as const, key: `${run.outputPrefix}${f.path}`, expiresIn: RESULT_URL_TTL_S }));
      const links = getOps.length ? await host.presign(getOps) : [];
      return {
        output: res.body.output ?? null,
        outputPrefix: run.outputPrefix,
        files: files.map((f, i) => ({ path: f.path, key: getOps[i]!.key, size: f.size, contentType: f.contentType, url: links[i]?.url })),
        durationMs: res.body.durationMs,
        logTail: String(res.body.stderr ?? "").slice(-2000) || undefined,
      };
    } finally {
      host.runs.finish(run.id);
    }
  },
};

