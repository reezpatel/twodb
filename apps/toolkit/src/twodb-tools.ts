/**
 * TwoDB tools — the whole TwoDB API surface (what `twodb <app> <command>` reaches from the CLI) as agent tools, derived
 * live from each installed app's manifest. Nothing is configured per instance: the catalog is fixed, and a tool is
 * callable only when enabled for the calling agent or for the space of the call (see `isAllowed`).
 *
 * Agents see four meta-tools instead of hundreds of tool definitions — get_apps → get_app_tools → get_app_tool →
 * invoke_app_tool — so the context cost stays flat no matter how many apps and endpoints exist.
 */

/**
 * Apps never exposed: toolkit holds this very access config (an agent must not grant itself tools), and the control
 * plane's own API (users, API keys, apps) is session/API-key only — it has no machine-to-machine path.
 */
export const EXCLUDED_APPS = new Set(["toolkit", "twodb"]);

export interface TwoDbParam {
  name: string;
  in: "path" | "query" | "body";
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required: boolean;
  options?: string[];
}

export interface TwoDbTool {
  /** Stable `<app>/<name>` key — what the per-scope allow-lists store. */
  key: string;
  app: string;
  appName: string;
  name: string;
  description: string;
  method: string;
  /** Path relative to `/apps/<app>` (i.e. the manifest basePath tail + endpoint path), `:param` placeholders intact. */
  path: string;
  params: TwoDbParam[];
}

export interface CatalogApp {
  slug: string;
  name: string;
  basePath: string;
  manifest: {
    basePath?: string;
    endpoints?: Array<{ name: string; method: string; path: string; auth?: string; description?: string; streaming?: boolean; request?: unknown }>;
  } | null;
}

interface JsonSchemaProp { type?: string | string[]; description?: string; enum?: unknown[] }

const BODYLESS = new Set(["GET", "DELETE", "HEAD"]);

function paramType(p: JsonSchemaProp | undefined): TwoDbParam["type"] {
  const t = Array.isArray(p?.type) ? p!.type.find((x) => x !== "null") : p?.type;
  if (t === "number" || t === "integer") return "number";
  if (t === "boolean" || t === "array" || t === "object") return t;
  return "string";
}

/** One endpoint → one tool. Streaming and session-only endpoints cannot run machine-to-machine, so they are skipped. */
export function deriveTools(apps: CatalogApp[]): TwoDbTool[] {
  const out: TwoDbTool[] = [];
  for (const app of apps) {
    if (EXCLUDED_APPS.has(app.slug) || !app.manifest?.endpoints) continue;
    // manifest.basePath is the gateway path (`/apps/<slug>/api`); serviceFetch re-adds `/apps/<slug>`.
    const base = (app.manifest.basePath ?? app.basePath ?? "").replace(new RegExp(`^/apps/${app.slug}`), "").replace(/\/+$/, "");
    for (const ep of app.manifest.endpoints) {
      if (ep.streaming || ep.auth === "session") continue;
      const schema = (ep.request ?? {}) as { properties?: Record<string, JsonSchemaProp>; required?: string[] };
      const props = schema.properties ?? {};
      const required = new Set(schema.required ?? []);
      const pathParams = [...ep.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
      const params: TwoDbParam[] = [];
      for (const name of pathParams) {
        params.push({ name, in: "path", type: "string", description: props[name]?.description ?? "", required: true });
      }
      const loc: TwoDbParam["in"] = BODYLESS.has(ep.method.toUpperCase()) ? "query" : "body";
      for (const [name, p] of Object.entries(props)) {
        if (pathParams.includes(name)) continue;
        params.push({
          name, in: loc, type: paramType(p), description: p.description ?? "", required: required.has(name),
          ...(Array.isArray(p.enum) ? { options: p.enum.map(String) } : {}),
        });
      }
      out.push({
        key: `${app.slug}/${ep.name}`, app: app.slug, appName: app.name, name: ep.name,
        description: ep.description ?? "", method: ep.method.toUpperCase(), path: `${base}${ep.path}`, params,
      });
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

export interface BuiltCall { method: string; path: string; query: Record<string, string>; body?: Record<string, unknown> }

/** Validates agent-supplied params against a tool and builds the HTTP call (path substitution, query vs JSON body). */
export function buildCall(tool: TwoDbTool, raw: Record<string, unknown>): BuiltCall | { error: string } {
  let path = tool.path;
  const query: Record<string, string> = {};
  const body: Record<string, unknown> = {};
  for (const p of tool.params) {
    let v = raw[p.name];
    const empty = v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    if (empty) {
      if (p.required) return { error: `missing required parameter "${p.name}"${p.description ? ` (${p.description})` : ""}` };
      continue;
    }
    if (p.type === "number" && typeof v === "string") {
      const n = Number(v);
      if (!Number.isFinite(n)) return { error: `parameter "${p.name}" must be a number` };
      v = n;
    } else if (p.type === "boolean" && typeof v === "string") {
      v = v === "true" || v === "1";
    } else if ((p.type === "array" || p.type === "object") && typeof v === "string") {
      try { v = JSON.parse(v); } catch { return { error: `parameter "${p.name}" must be valid JSON (${p.type})` }; }
    }
    if (p.options && !p.options.includes(String(v))) return { error: `parameter "${p.name}" must be one of: ${p.options.join(", ")}` };
    if (p.in === "path") path = path.replace(`:${p.name}`, encodeURIComponent(String(v)));
    else if (p.in === "query") query[p.name] = typeof v === "object" ? JSON.stringify(v) : String(v);
    else body[p.name] = v;
  }
  // Manifests don't always declare every field an endpoint reads (some list only path params), so undeclared params are
  // passed through — as query for GET/DELETE, as JSON body otherwise — rather than making those tools uncallable.
  const declared = new Set(tool.params.map((p) => p.name));
  for (const [k, v] of Object.entries(raw)) {
    if (declared.has(k) || v === undefined || v === null) continue;
    if (BODYLESS.has(tool.method)) query[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
    else body[k] = v;
  }
  return { method: tool.method, path, query, ...(BODYLESS.has(tool.method) ? {} : { body }) };
}

/** A tool is callable when enabled for the calling agent OR for any space of the call (independent allow-lists; default none). */
export function isAllowed(key: string, agentTools: string[], spaceTools: string[][]): boolean {
  return agentTools.includes(key) || spaceTools.some((t) => t.includes(key));
}
