import { promises as fs } from "node:fs";
import * as path from "node:path";

/**
 * App-declared CLI surface (cli.json). An app checks in `src/cli.ts` using
 * `defineAppCli`, generates `cli.json` alongside endpoint.json (`pnpm
 * gen:docs`), and reports it at registration. The twodb CLI then exposes its
 * commands as `twodb <slug> <command>` — anything not covered falls back to
 * commands derived from endpoint.json.
 */

export interface CliCallSpec {
  method: string;
  /** Path relative to the app's basePath; `{placeholders}` resolve from params. */
  path: string;
  /** Static query params merged in. */
  query?: Record<string, string>;
}

export interface CliInvokeSpec {
  method: string;
  /** Path for one item, `{id}` = the item's id. Defaults to the command's call path. */
  path?: string;
  /** Static JSON body; string values are `{placeholder}` templates resolved from the item. */
  body?: Record<string, unknown>;
  /** Where --param k=v pairs land in the body (e.g. "params"). Omit = body root. */
  paramsKey?: string;
}

export interface CliCommandDef {
  /** Subcommand name, e.g. "tools" → `twodb <app> tools`. */
  name: string;
  description: string;
  /** The HTTP call the bare command maps to. */
  call?: CliCallSpec;
  /** Static params merged into query (GET/DELETE) or body (POST/…). */
  params?: Record<string, unknown>;
  /**
   * Mark the command as a list: running it prints items from `call` (an array
   * response, or `{ items | tools | results | data | <name>: [...] }`), each
   * item becomes invocable as `twodb <app> <command> <id> --param k=v`.
   */
  listCommand?: boolean;
  /** Item field holding the id (default chain: id, toolId, name, slug). */
  idFromList?: string;
  /** Per-item description template, `{field}` placeholders resolve from the item. */
  describeItem?: string;
  /** How invoking one listed item maps to HTTP. */
  invoke?: CliInvokeSpec;
}

export interface AppCliSpec {
  slug: string;
  description?: string;
  commands: CliCommandDef[];
}

export function defineAppCli(spec: AppCliSpec): AppCliSpec {
  return spec;
}

/** The cli.json document the twodb CLI consumes (GET /registry/apps/:slug/cli.json). */
export interface CliJson {
  slug: string;
  description?: string;
  commands: CliCommandDef[];
  generatedAt: string;
}

export function toCliJson(cli: AppCliSpec): CliJson {
  return {
    slug: cli.slug,
    description: cli.description,
    commands: cli.commands,
    generatedAt: new Date().toISOString(),
  };
}

export async function writeCliArtifacts(cli: AppCliSpec, outDir: string): Promise<{ cliJsonPath: string }> {
  await fs.mkdir(outDir, { recursive: true });
  const cliJsonPath = path.join(outDir, "cli.json");
  await fs.writeFile(cliJsonPath, JSON.stringify(toCliJson(cli), null, 2) + "\n", "utf8");
  return { cliJsonPath };
}
