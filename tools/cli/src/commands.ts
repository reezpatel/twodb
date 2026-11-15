import type { AppCliInfo, AppSummary, CliCommandSpec, EndpointJson } from "./types.js";
import { buildInvocation, fetchAppCliInfo, resolveCommands, type Invocation, type ResolvedCommand } from "./app-commands.js";
import { bold, cyan, dim, green, pad, prettyJson, printHelp, readStdin, red, wrap, yellow } from "./ui.js";
import { schemaPropertyNames } from "./args.js";

// ---------------------------------------------------------------------------
// apps listing
// ---------------------------------------------------------------------------

export async function listApps(gatewayBase: string, apiKey: string): Promise<AppSummary[]> {
  const res = await fetch(`${gatewayBase}/registry/apps`, { headers: { "x-api-key": apiKey } });
  if (!res.ok) throw new Error(`GET /registry/apps → ${res.status} ${res.statusText}`);
  return (await res.json()) as AppSummary[];
}

// ---------------------------------------------------------------------------
// help output
// ---------------------------------------------------------------------------

export async function mainHelp(gatewayBase: string, apiKey: string): Promise<number> {
  const apps = await listApps(gatewayBase, apiKey).catch(() => [] as AppSummary[]);
  const lines: string[] = [];
  lines.push(bold("twodb") + dim(" — one CLI for every app installed on your TwoDB control plane"));
  lines.push("");
  lines.push(cyan("Usage:"));
  lines.push("  twodb <app> <command> [params]     " + dim("an app's API as commands"));
  lines.push("  twodb <app> get|post|... <path>    " + dim("raw call: twodb <app> get /things --query k=v"));
  lines.push("");
  lines.push(cyan("Core commands:"));
  lines.push("  " + pad("auth <url>", 22) + dim("login against a control plane"));
  lines.push("  " + pad("apps", 22) + dim("list installed apps"));
  lines.push("  " + pad("tools --list", 22) + dim("every toolkit connector tool (twodb toolkit tools)"));
  lines.push("  " + pad("version", 22) + dim("print CLI version"));
  lines.push("");
  lines.push(cyan("Installed apps") + dim("  (twodb <app> --help for each)"));
  if (!apps.length) {
    lines.push("  " + dim("(none — is the control plane running? try twodb apps)"));
  } else {
    for (const app of apps) {
      const dot = app.status === "active" ? green("●") : yellow("○");
      lines.push(`  ${dot} ${pad(app.slug, 18)} ${dim(truncate(app.name, 34))}`);
    }
  }
  lines.push("");
  lines.push(dim(`config: ~/.config/twodb/cli.json · flags: --param k=v · --query k=v · --data '<json>' · stdin = body`));
  printHelp(lines);
  return 0;
}

export async function appHelp(gatewayBase: string, apiKey: string, appSlug: string): Promise<number> {
  let info: AppCliInfo;
  try {
    info = await fetchAppCliInfo(gatewayBase, apiKey, appSlug);
  } catch (err) {
    process.stderr.write(`twodb: ${(err as Error).message}\n`);
    return 1;
  }
  const manifest = info.manifest;
  const lines: string[] = [];
  lines.push(bold(`twodb ${appSlug}`) + dim(` — ${manifest?.name ?? appSlug} ${manifest?.version ?? ""}`.trimEnd()));
  if (manifest?.description) {
    lines.push(wrap(manifest.description, 2));
  }
  lines.push("");
  lines.push(cyan("Usage:"));
  lines.push(`  twodb ${appSlug} <command> [params]`);
  lines.push(`  twodb ${appSlug} get|post|put|patch|delete <path> [--query k=v] [--param k=v] [< body.json]`);
  lines.push("");
  lines.push(cyan("Commands:"));
  const commands = resolveCommands(info);
  for (const cmd of commands) {
    lines.push("  " + pad(cmd.name, 26) + dim(commandHint(cmd)));
    if (cmd.spec.description) lines.push(wrap(cmd.spec.description, 30, 110));
  }
  lines.push("");
  lines.push(dim("body: stdin or --data '<json>' · values coerce to the endpoint's schema types"));
  printHelp(lines);
  return 0;
}

function commandHint(cmd: ResolvedCommand): string {
  if (cmd.endpoint) return `${cmd.endpoint.method} ${cmd.endpoint.path}`;
  if (cmd.spec.listCommand) return `list${cmd.spec.invoke ? " + invoke <id>" : ""}`;
  if (cmd.spec.call) return `${cmd.spec.call.method.toUpperCase()} ${cmd.spec.call.path}`;
  return "";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ---------------------------------------------------------------------------
// running commands
// ---------------------------------------------------------------------------

export async function runAppCommand(gatewayBase: string, apiKey: string, appSlug: string, argv: string[]): Promise<number> {
  const commandName = argv[0];
  if (!commandName || commandName === "help" || commandName === "--help" || commandName === "-h") {
    return appHelp(gatewayBase, apiKey, appSlug);
  }
  const info = await fetchAppCliInfo(gatewayBase, apiKey, appSlug);
  const commands = resolveCommands(info);
  const cmd = commands.find((c) => c.name === commandName);

  if (!cmd) {
    // Leading flags only (`twodb tools --list`): treat --list as the single
    // list command's listing, anything else as help.
    if (commandName.startsWith("--")) {
      const { values } = splitFlags(argv);
      const lists = commands.filter((c) => c.spec.listCommand);
      if (values.list && lists.length >= 1) return printList(gatewayBase, apiKey, appSlug, info, lists[0]!.spec);
      return appHelp(gatewayBase, apiKey, appSlug);
    }
    // A dynamic item id for the app's single list command? (e.g. `twodb tools 01J….list_projects`)
    const lists = commands.filter((c) => c.spec.listCommand && c.spec.invoke);
    if (lists.length === 1) {
      return invokeListed(gatewayBase, apiKey, appSlug, info, lists[0]!.spec, argv);
    }
    process.stderr.write(`twodb: unknown command "${commandName}" for ${appSlug} — run \`twodb ${appSlug} --help\`\n`);
    return 1;
  }

  const rest = argv.slice(1);
  if (cmd.spec.listCommand) {
    const { values, positional } = splitFlags(rest);
    if (positional.length === 0 || values.help || values.list) {
      return printList(gatewayBase, apiKey, appSlug, info, cmd.spec);
    }
    return invokeListed(gatewayBase, apiKey, appSlug, info, cmd.spec, rest);
  }
  const { values, positional, kv } = splitFlags(rest);
  const params = { ...(kv.param ?? {}), ...positionalKv(positional) };
  const data = await readData(values);
  const invocation = buildInvocation({
    basePath: basePathOf(info, appSlug),
    spec: cmd.spec,
    endpoint: cmd.endpoint,
    args: { params, query: kv.query ?? {}, data },
  });
  return sendAndPrint(gatewayBase, apiKey, invocation);
}

function basePathOf(info: AppCliInfo, appSlug: string): string {
  const bp = info.manifest?.basePath || `/apps/${appSlug}`;
  // TwoDB's own manifest declares basePath "/" — its endpoints are gateway-absolute.
  return bp === "/" ? "" : bp;
}

async function readData(values: Record<string, string | boolean>): Promise<unknown> {
  if (typeof values.data === "string") return parseLooseJson(values.data);
  const stdin = await readStdin();
  if (stdin) return parseLooseJson(stdin);
  return undefined;
}

function parseLooseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// --- list commands ---------------------------------------------------------

async function listItems(gatewayBase: string, apiKey: string, appSlug: string, info: AppCliInfo, spec: CliCommandSpec): Promise<Record<string, unknown>[]> {
  if (!spec.call) throw new Error(`list command "${spec.name}" declares no call`);
  const res = await apiJson(gatewayBase, apiKey, spec.call.method.toUpperCase(), basePathOf(info, appSlug) + spec.call.path);
  let arr: unknown = res;
  if (!Array.isArray(res) && res && typeof res === "object") {
    const rec = res as Record<string, unknown>;
    for (const k of ["items", "tools", "results", "data", spec.name]) {
      if (Array.isArray(rec[k])) {
        arr = rec[k];
        break;
      }
    }
  }
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [res as Record<string, unknown>];
}

async function printList(gatewayBase: string, apiKey: string, appSlug: string, info: AppCliInfo, spec: CliCommandSpec): Promise<number> {
  const items = await listItems(gatewayBase, apiKey, appSlug, info, spec).catch((err) => {
    process.stderr.write(`twodb: ${(err as Error).message}\n`);
    return null;
  });
  if (items === null) return 1;
  const lines: string[] = [];
  lines.push(bold(`twodb ${appSlug} ${spec.name}`) + dim(` — ${spec.description}`));
  lines.push("");
  if (!items.length) {
    lines.push("  " + dim("(no items)"));
  } else {
    for (const item of items) {
      const id = itemIdentifier(item, spec);
      const desc = spec.describeItem ? describeFromTemplate(spec.describeItem, item) : itemSummary(item);
      lines.push("  " + pad(id, 46) + dim(truncate(desc, 60)));
    }
  }
  lines.push("");
  lines.push(dim(`invoke: twodb ${appSlug} ${spec.name} <id> --param k=v`));
  printHelp(lines);
  return 0;
}

async function invokeListed(gatewayBase: string, apiKey: string, appSlug: string, info: AppCliInfo, spec: CliCommandSpec, argv: string[]): Promise<number> {
  const { positional, kv, values } = splitFlags(argv);
  const id = positional[0] ?? (typeof values.id === "string" ? values.id : undefined);
  if (!id) return printList(gatewayBase, apiKey, appSlug, info, spec);
  const items = await listItems(gatewayBase, apiKey, appSlug, info, spec).catch(() => [] as Record<string, unknown>[]);
  const item = items.find((it) => itemIdentifier(it, spec) === id);
  if (!item) {
    // Not listed (or list failed) — still allow invoking by raw id when the
    // command maps invoke paths by {id} alone.
    if (!spec.invoke?.path?.includes("{id}")) {
      process.stderr.write(`twodb: no ${spec.name} item "${id}" — run \`twodb ${appSlug} ${spec.name} --list\`\n`);
      return 1;
    }
  }
  const data = await readData(values);
  const invocation = buildInvocation({
    basePath: basePathOf(info, appSlug),
    spec,
    args: { params: kv.param ?? {}, query: kv.query ?? {}, data, item: item ?? { id } },
  });
  return sendAndPrint(gatewayBase, apiKey, invocation);
}

function itemIdentifier(item: Record<string, unknown>, spec: CliCommandSpec): string {
  for (const key of [spec.idFromList, "id", "toolId", "name", "slug"]) {
    if (!key) continue;
    const v = item[key];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return JSON.stringify(item).slice(0, 44);
}

function describeFromTemplate(template: string, item: Record<string, unknown>): string {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(item)) {
    if (v === null || typeof v === "object") continue;
    vars[k] = String(v);
  }
  return template.replace(/\{(\w+)\}/g, (whole, k: string) => vars[k] ?? whole);
}

function itemSummary(item: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const k of ["name", "title", "command", "description", "summary", "templateId", "instanceId"]) {
    const v = item[k];
    if (typeof v === "string" && v) parts.push(v);
    if (parts.join(" — ").length > 60) break;
  }
  return parts.join(" — ");
}

// ---------------------------------------------------------------------------
// raw calls: twodb <app> get|post|put|patch|delete <path>
// ---------------------------------------------------------------------------

const METHODS = new Set(["get", "post", "put", "patch", "delete"]);

export function isRawMethod(token: string): boolean {
  return METHODS.has(token.toLowerCase());
}

export async function runRawCall(gatewayBase: string, apiKey: string, appSlug: string, method: string, argv: string[]): Promise<number> {
  const pathArg = argv[0];
  if (!pathArg || pathArg === "--help" || pathArg === "-h") {
    printHelp([
      bold(`twodb ${appSlug} ${method.toLowerCase()}`) + dim(" — raw call through the gateway"),
      "",
      `${cyan("Usage:")} twodb ${appSlug} ${method.toLowerCase()} <path> [--query k1=v1 k2=v2] [--param k=v] [< body.json]`,
      "",
      `  <path>  relative to the app's base path, e.g. /threads/01J…/messages`,
      `  --query / --param take several pairs: --query a=1 b=2`,
      `  POST/PUT/PATCH body from stdin or --data '<json>'`,
    ]);
    return 0;
  }
  const { kv, values } = splitFlags(argv.slice(1));
  let body: unknown;
  if (typeof values.data === "string") {
    body = parseLooseJson(values.data);
  } else {
    const stdin = await readStdin();
    if (stdin && stdin.trim()) body = parseLooseJson(stdin);
  }
  const apps = await listApps(gatewayBase, apiKey).catch(() => [] as AppSummary[]);
  const found = apps.find((a) => a.slug === appSlug);
  let basePath = found?.basePath ?? `/apps/${appSlug}`;
  if (basePath === "/") basePath = "";
  return sendAndPrint(gatewayBase, apiKey, {
    method: method.toUpperCase(),
    path: basePath + (pathArg.startsWith("/") ? pathArg : "/" + pathArg),
    query: { ...(kv.query ?? {}), ...(kv.param ?? {}) },
    body: body as Record<string, unknown> | undefined,
  });
}

// ---------------------------------------------------------------------------
// flag parsing (shared)
// ---------------------------------------------------------------------------

export interface SplitFlags {
  values: Record<string, string | boolean>;
  positional: string[];
  kv: Record<string, Record<string, string>>;
}

/**
 * Splits argv into flags, positionals and kv-bags. `--query a=1 b=2` and
 * `--param k=v` both collect into kv bags; bare k=v positionals (e.g. after a
 * listed-item id) are NOT auto-collected — callers merge positionalKv().
 */
export function splitFlags(argv: string[]): SplitFlags {
  const values: Record<string, string | boolean> = {};
  const positional: string[] = [];
  const kv: Record<string, Record<string, string>> = {};
  let currentKv: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const name = eq >= 0 ? a.slice(2, eq) : a.slice(2);
      currentKv = null;
      if (name === "query" || name === "param" || name === "header") {
        if (eq >= 0) {
          addKv(kv, name, a.slice(eq + 1));
        } else if (i + 1 < argv.length && !argv[i + 1]!.startsWith("--") && argv[i + 1]!.includes("=")) {
          addKv(kv, name, argv[++i]!);
          currentKv = name;
        } else {
          currentKv = name;
        }
      } else if (eq >= 0) {
        values[name] = a.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1]!.startsWith("--") && !argv[i + 1]!.includes("=")) {
        values[name] = argv[++i]!;
      } else {
        values[name] = true;
      }
    } else if (currentKv && /^[^=]+==*$/.test(a) === false && a.includes("=") && !a.startsWith("/")) {
      addKv(kv, currentKv, a);
    } else {
      positional.push(a);
      currentKv = null;
    }
  }
  return { values, positional, kv };
}

function addKv(kv: Record<string, Record<string, string>>, bag: string, s: string): void {
  const eq = s.indexOf("=");
  if (eq <= 0) return;
  kv[bag] = { ...(kv[bag] ?? {}), [s.slice(0, eq)]: s.slice(eq + 1) };
}

function positionalKv(positional: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of positional) {
    const eq = p.indexOf("=");
    if (eq > 0 && !p.startsWith("/") && !p.startsWith("-")) out[p.slice(0, eq)] = p.slice(eq + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// HTTP + output
// ---------------------------------------------------------------------------

async function apiJson(gatewayBase: string, apiKey: string, method: string, path: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = { "x-api-key": apiKey };
  let payload: string | undefined;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(gatewayBase + path, { method, headers, body: payload });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${res.statusText}\n${text}`);
  return text ? JSON.parse(text) : undefined;
}

export async function sendAndPrint(gatewayBase: string, apiKey: string, invocation: Invocation): Promise<number> {
  const url = new URL(gatewayBase + invocation.path);
  for (const [k, v] of Object.entries(invocation.query)) if (v !== undefined && v !== "") url.searchParams.set(k, v);
  const headers: Record<string, string> = { "x-api-key": apiKey, accept: "application/json" };
  let body: string | undefined;
  if (invocation.body !== undefined && invocation.method !== "GET" && invocation.method !== "DELETE") {
    headers["content-type"] = "application/json";
    body = JSON.stringify(invocation.body, null, 0);
  }
  const res = await fetch(url, { method: invocation.method, headers, body });
  const text = await res.text();
  if (!res.ok) {
    process.stderr.write(red(`${invocation.method} ${invocation.path} → ${res.status} ${res.statusText}\n`));
    if (text) process.stderr.write(text + "\n");
    return 1;
  }
  try {
    process.stdout.write(prettyJson(JSON.parse(text)) + "\n");
  } catch {
    process.stdout.write(text + (text.endsWith("\n") ? "" : "\n"));
  }
  return 0;
}
