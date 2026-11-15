/** ~/<configHome>/twodb/cli.json — everything the CLI needs to talk to one control plane. */
export interface CliConfig {
  /** Control-plane base URL, e.g. https://twodb.example.com (no trailing slash). */
  gateway: string;
  /** Workspace API key (twodb_<hex>_<hex>) — sent as x-api-key on every call. */
  apiKey?: string;
  /** Dev servers with self-signed certs: skip TLS verification (NODE_TLS_REJECT_UNAUTHORIZED=0). */
  insecure?: boolean;
  /** Set once after `twodb auth` — purely informational. */
  auth?: {
    user?: string;
    workspace?: string;
    workspaceId?: string;
    apiKeyName?: string;
    authenticatedAt?: string;
  };
}

export function configDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg ? `${xdg}/twodb` : home ? `${home}/.config/twodb` : ".twodb";
  return base;
}

export function configPath(): string {
  return `${configDir()}/cli.json`;
}

export async function readConfig(): Promise<CliConfig | null> {
  const { promises: fs } = await import("node:fs");
  try {
    const raw = await fs.readFile(configPath(), "utf8");
    const parsed = JSON.parse(raw) as CliConfig;
    if (typeof parsed.gateway === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function writeConfig(config: CliConfig): Promise<void> {
  const { promises: fs } = await import("node:fs");
  await fs.mkdir(configDir(), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2) + "\n", "utf8");
}

/** Reads config or exits with the "run twodb auth" message. */
export async function requireConfig(): Promise<CliConfig> {
  const config = await readConfig();
  if (!config) {
    fail(`no CLI config at ${configPath()} — run \`twodb auth <control-plane-url>\` first`);
  }
  if (!config.apiKey) {
    fail(`config has no API key — run \`twodb auth <control-plane-url>\` to (re)authenticate`);
  }
  applyInsecure(config);
  return config;
}

/**
 * Dev gateways run on self-signed/mkcert certs the CLI's Node doesn't trust.
 * `--insecure` (or `"insecure": true` in the config, or
 * TWODB_INSECURE=1) turns off TLS verification for this process — never for
 * production hosts.
 */
export function applyInsecure(config: { gateway: string; insecure?: boolean }): void {
  const forced = process.env.TWODB_INSECURE === "1";
  const localhostish = isLocalHost(config.gateway);
  if (config.insecure || forced || (localhostish && process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined)) {
    if (!localhostish) {
      fail("--insecure on a non-localhost gateway: refusing (remove the flag for https://<production>)");
    }
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
}

function isLocalHost(gateway: string): boolean {
  try {
    const host = new URL(gateway).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local") || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  } catch {
    return false;
  }
}

export function fail(message: string): never {
  process.stderr.write(`twodb: ${message}\n`);
  process.exit(1);
}
