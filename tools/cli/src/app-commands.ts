import type { AppCliInfo, CliCommandSpec, EndpointJson } from "./types.js";
import { pathParamsOf, resolveTemplate, schemaPropertyNames } from "./args.js";

export interface ResolvedCommand {
  name: string;
  spec: CliCommandSpec;
  /** Set when the command is a fallback derived from an endpoint (not from cli.json). */
  endpoint?: EndpointJson["endpoints"][number];
}

/** Fetches an app's cli.json + endpoint.json in one call, as served by the control plane. */
export async function fetchAppCliInfo(gatewayBase: string, apiKey: string, slug: string): Promise<AppCliInfo> {
  const res = await fetch(`${gatewayBase}/registry/apps/${slug}/cli.json`, { headers: { "x-api-key": apiKey } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET /registry/apps/${slug}/cli.json → ${res.status} ${res.statusText} ${text}`.trim());
  }
  return (await res.json()) as AppCliInfo;
}

/** cli.json commands first; manifest endpoints become fallback commands (skipping name collisions). */
export function resolveCommands(info: AppCliInfo): ResolvedCommand[] {
  const commands: ResolvedCommand[] = [];
  const names = new Set<string>();
  for (const spec of info.cli?.commands ?? []) {
    commands.push({ name: spec.name, spec });
    names.add(spec.name);
  }
  for (const endpoint of info.manifest?.endpoints ?? []) {
    if (names.has(endpoint.name)) continue;
    commands.push({
      name: endpoint.name,
      spec: { name: endpoint.name, description: endpoint.description, call: { method: endpoint.method, path: endpoint.path } },
      endpoint,
    });
  }
  return commands;
}

export interface Invocation {
  method: string;
  /** Absolute path (base + endpoint path), placeholders resolved. */
  path: string;
  query: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface CommandArgs {
  params: Record<string, string>;
  query: Record<string, string>;
  data?: unknown;
  item?: Record<string, unknown>;
}

function coercionFor(endpoint: EndpointJson["endpoints"][number] | undefined, name: string, schema: unknown): (v: string) => unknown {
  const prop = schemaPropertyNames(schema).find((p) => p.name === name);
  const type = prop?.type;
  if (type === "number" || type === "integer") return (v) => (looksNumeric(v) ? Number(v) : v);
  if (type === "boolean") return (v) => v === "true" || v === "1";
  if (type === "array") return (v) => (v.startsWith("[") ? safeJson(v) : v.split(",").map((s) => s.trim()));
  if (type === "object") return (v) => safeJson(v);
  void endpoint;
  return (v) => v;
}

function looksNumeric(v: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(v);
}

function safeJson(v: string): unknown {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

/** Reads an item's identifier using the command's idFromList with sensible fallbacks. */
export function itemId(item: Record<string, unknown>, idFromList?: string): string | undefined {
  const preferred = idFromList ?? "id";
  for (const key of [preferred, "id", "toolId", "name", "slug"]) {
    const v = item[key];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

/**
 * Builds the HTTP call a command run maps to:
 *  - cli.json command: `call` + `params` statics, {id} templates from the item.
 *  - fallback endpoint command: path params from --param, query from schema, body from --data/stdin.
 */
export function buildInvocation(opts: { basePath: string; spec: CliCommandSpec; endpoint?: EndpointJson["endpoints"][number]; args: CommandArgs }): Invocation {
  const { spec, endpoint, args } = opts;
  const call = spec.call ?? (endpoint ? { method: endpoint.method, path: endpoint.path } : undefined);
  if (!call) throw new Error(`command "${spec.name}" declares no HTTP mapping`);

  // Template vars: item fields first, then explicit --param overrides.
  const vars: Record<string, string> = {};
  if (args.item) {
    for (const [k, v] of Object.entries(args.item)) {
      if (v === null || typeof v === "object") continue;
      vars[k] = String(v);
    }
    const id = itemId(args.item, spec.idFromList);
    if (id !== undefined) vars.id = vars.id ?? id;
  }
  for (const [k, v] of Object.entries(args.params)) vars[k] = v;

  // --- listed-item invoke path (cli.json `invoke`) ------------------------
  if (args.item && spec.invoke) {
    const invoke = spec.invoke;
    const path = invoke.path
      ? opts.basePath + resolveTemplate(invoke.path, vars)
      : resolveTemplatesInPath(opts.basePath + call.path, vars);
    const body: Record<string, unknown> = { ...(invoke.body ?? {}) };
    for (const [k, v] of Object.entries(invoke.body ?? {})) {
      if (typeof v === "string") body[k] = resolveTemplate(v, vars);
    }
    const paramsKey = invoke.paramsKey;
    if (paramsKey) {
      const existing = body[paramsKey];
      body[paramsKey] = {
        ...(existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {}),
        ...coerceParams(args.params, endpoint, "body"),
      };
    }
    if (args.data !== undefined && args.data && typeof args.data === "object" && !Array.isArray(args.data)) {
      Object.assign(body, args.data as Record<string, unknown>);
    }
    return { method: invoke.method.toUpperCase(), path, query: { ...(call.query ?? {}) }, body };
  }

  // --- plain command / fallback endpoint ----------------------------------
  const method = call.method.toUpperCase();
  const declaredPathParams = pathParamsOf(call.path);
  const path = resolveTemplatesInPath(opts.basePath + call.path, vars);
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(call.query ?? {})) query[k] = v;

  const schemaProps = schemaPropertyNames(endpoint?.request);
  const propType = (name: string) => schemaProps.find((p) => p.name === name)?.type;

  if (method === "GET" || method === "DELETE") {
    // Non-path params become query params.
    for (const [k, v] of Object.entries(args.params)) {
      if (declaredPathParams.includes(k)) continue;
      query[k] = v;
    }
    for (const [k, v] of Object.entries(args.query)) query[k] = v;
    return { method, path, query };
  }

  // POST/PUT/PATCH: params go into the JSON body (schema-coerced), --data/stdin merges over.
  const body: Record<string, unknown> = { ...(spec.params ?? {}) };
  for (const [k, v] of Object.entries(coerceParams(args.params, endpoint, "body"))) body[k] = v;
  for (const [k, v] of Object.entries(args.query)) {
    const t = propType(k);
    body[k] = t === "number" && looksNumeric(v) ? Number(v) : v;
  }
  if (args.data !== undefined) {
    if (args.data && typeof args.data === "object" && !Array.isArray(args.data)) {
      Object.assign(body, args.data as Record<string, unknown>);
    } else {
      return { method, path, query, body: { ...body, value: args.data } };
    }
  }
  return { method, path, query, body };
}

function coerceParams(params: Record<string, string>, endpoint: EndpointJson["endpoints"][number] | undefined, _mode: "body"): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) out[k] = coercionFor(endpoint, k, endpoint?.request)(v);
  return out;
}

/** Replaces `:param` and `{param}` path segments that have a value; leaves the rest untouched. */
function resolveTemplatesInPath(path: string, vars: Record<string, string>): string {
  return path
    .replace(/\{(\w+)\}/g, (whole, name: string) => (vars[name] !== undefined && vars[name] !== "" ? vars[name]! : whole))
    .replace(/\/:(\w+)(?=[/?#]|$)/g, (whole, name: string) => {
      const v = vars[name];
      return v !== undefined && v !== "" ? "/" + encodeURIComponent(v) : whole;
    });
}
