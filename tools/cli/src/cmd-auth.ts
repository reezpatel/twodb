import * as fs from "node:fs/promises";
import { loginAndMintApiKey } from "./auth-flow.js";
import { applyInsecure, configPath, readConfig, writeConfig, type CliConfig } from "./config.js";
import { bold, cyan, dim, green, printHelp } from "./ui.js";

export async function cmdAuth(argv: string[]): Promise<number> {
  const sub = argv[0];
  if (!sub || sub === "--help" || sub === "-h") {
    printHelp([
      bold("twodb auth") + dim(" — authenticate this machine against a control plane"),
      "",
      `${cyan("Usage:")} twodb auth <control-plane-url> [--no-open] [--name <key-name>] [--insecure]`,
      `       twodb auth status`,
      `       twodb auth logout`,
      `       twodb auth api-key [--name <key-name>]   ${dim("(re-mint; requires existing login)")}`,
      "",
      `Opens your browser at the control plane, asks you to confirm, and mints`,
      `a workspace API key that is stored in ${configPath()}.`,
    ]);
    return 0;
  }
  if (sub === "status") {
    const config = await readConfig();
    if (!config) {
      process.stdout.write("not authenticated — no config\n");
      return 1;
    }
    process.stdout.write(`gateway:    ${config.gateway}\n`);
    process.stdout.write(`api key:    ${config.apiKey ? green("present") : red2("missing")}\n`);
    if (config.auth) {
      process.stdout.write(`user:       ${config.auth.user ?? "?"}\n`);
      process.stdout.write(`workspace:  ${config.auth.workspace ?? "?"} (${config.auth.workspaceId ?? "?"})\n`);
      process.stdout.write(`since:      ${config.auth.authenticatedAt ?? "?"}\n`);
    }
    return 0;
  }
  if (sub === "logout") {
    try {
      await fs.rm(configPath());
      process.stdout.write(`removed ${configPath()}\n`);
    } catch {
      process.stdout.write("nothing to remove\n");
    }
    return 0;
  }
  if (sub === "api-key") {
    const config = await readConfig();
    if (!config?.apiKey) {
      process.stderr.write("twodb: not authenticated — run twodb auth <url> first\n");
      return 1;
    }
    // Re-run the flow to mint a fresh key (session needed server-side).
    const url = argv[1];
    const gateway = normalizeGateway(url ?? config.gateway);
    const opts = parseAuthFlags(argv.slice(2));
    if (opts.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    applyInsecure({ gateway, insecure: opts.insecure });
    const { apiKey, info } = await loginAndMintApiKey(gateway, opts);
    const next: CliConfig = { ...config, gateway, apiKey, auth: { ...config.auth, ...info, authenticatedAt: new Date().toISOString() } };
    await writeConfig(next);
    process.stdout.write(`minted API key for ${info.user} @ ${info.workspace} — saved to ${configPath()}\n`);
    return 0;
  }

  // twodb auth <url>
  const gateway = normalizeGateway(sub);
  const flags = parseAuthFlags(argv.slice(1));
  if (flags.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  applyInsecure({ gateway, insecure: flags.insecure });
  const { apiKey, info } = await loginAndMintApiKey(gateway, flags);
  const next: CliConfig = {
    gateway,
    apiKey,
    insecure: flags.insecure || undefined,
    auth: { user: info.user, workspace: info.workspace, workspaceId: info.workspaceId, apiKeyName: flags.name ?? `twodb-cli-${process.env.USER ?? "local"}`, authenticatedAt: new Date().toISOString() },
  };
  await writeConfig(next);
  process.stdout.write(`authenticated as ${bold(info.user)} in workspace ${bold(info.workspace)}\n`);
  process.stdout.write(`config written to ${dim(configPath())}\n`);
  return 0;
}

function parseAuthFlags(argv: string[]): { noOpen?: boolean; name?: string; insecure?: boolean } {
  const out: { noOpen?: boolean; name?: string; insecure?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--no-open") out.noOpen = true;
    if (argv[i] === "--insecure" || argv[i] === "--insecure=true") out.insecure = true;
    if (argv[i] === "--name" && argv[i + 1]) out.name = argv[++i];
  }
  return out;
}

export function normalizeGateway(input: string): string {
  let s = input.trim();
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  return s.replace(/\/+$/, "");
}

function red2(s: string): string {
  return s;
}
