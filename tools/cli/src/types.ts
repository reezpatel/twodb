/** CLI-facing shape of an app's endpoint.json (the control plane caches what apps report at registration). */
export interface EndpointJson {
  name: string;
  slug: string;
  version: string;
  shape: string;
  description: string;
  capabilities: string[];
  basePath: string;
  generatedAt: string;
  websocketPaths?: string[];
  endpoints: Array<{
    name: string;
    method: string;
    path: string;
    auth: string;
    description: string;
    capability?: string;
    streaming?: boolean;
    request?: unknown;
    response?: unknown;
  }>;
}

/** One entry of a cli.json `commands` array. */
export interface CliCommandSpec {
  /** Subcommand name, e.g. "tools". */
  name: string;
  description: string;
  /** HTTP call this command maps to when run directly. */
  call?: { method: string; path: string; query?: Record<string, string> };
  /** Static params merged into query (GET) or body (others). */
  params?: Record<string, unknown>;
  /**
   * When true the command lists dynamic items (the call's response — an array,
   * or `{ items: [...] }` / `{ tools: [...] }`) and each item becomes a
   * subcommand; `--list` / `--help` shows them. Running the command itself
   * just lists.
   */
  listCommand?: boolean;
  /** Field inside each listed item to use as the subcommand name (default "id"; falls back to "name", "slug", "toolId"). */
  idFromList?: string;
  /** Description template for listed items; {…} placeholders resolve from the item. */
  describeItem?: string;
  /** How running a listed item maps to an HTTP call. `{id}` in path/body is replaced with the item's id. */
  invoke?: { method: string; path?: string; body?: Record<string, unknown>; paramsKey?: string };
}

/** A cli.json file checked in per app. */
export interface CliJson {
  slug: string;
  description?: string;
  commands: CliCommandSpec[];
}

/** What GET /registry/apps/:slug/cli.json returns (cli spec + manifest for fallback commands). */
export interface AppCliInfo {
  cli?: CliJson | null;
  manifest: EndpointJson;
}

export interface AppSummary {
  slug: string;
  name: string;
  basePath: string;
  status: string;
  installStatus: string;
  version?: string;
  managed?: boolean;
  httpUrl?: string;
  capabilities?: string[];
}
