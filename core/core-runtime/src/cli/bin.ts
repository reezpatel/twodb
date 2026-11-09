#!/usr/bin/env node
import { Command } from "commander";
import { fetchAppManifest, fetchRegistryApps, type CliContext } from "./registry-client.js";
import { buildAppCommand } from "./build-command.js";

const program = new Command("twodb");
program
  .description(
    "twodb-cli — generates live commands from any registered app's endpoint.json, served by TwoDB's gateway registry.",
  )
  .option("--gateway <url>", "Gateway URL", process.env.TWODB_GATEWAY_URL ?? "http://localhost:4000")
  .option("--api-key <key>", "Workspace API key", process.env.TWODB_API_KEY)
  .option("--workspace <id>", "Workspace id (only needed for session auth, not API keys)")
  .option("--space <ids>", "Comma-separated space ids (session auth only)");

function getCtx(): CliContext {
  const opts = program.opts();
  return {
    gatewayUrl: opts.gateway,
    apiKey: opts.apiKey,
    workspaceId: opts.workspace,
    spaceIds: opts.space ? String(opts.space).split(",") : undefined,
  };
}

program
  .command("apps")
  .description("List every app registered with TwoDB")
  .action(async () => {
    const apps = await fetchRegistryApps(getCtx());
    for (const app of apps) {
      console.log(`${app.slug}\t${app.name}\t${app.basePath}`);
    }
  });

// Lazily resolves `twodb <app-slug> ...` by fetching that one app's manifest,
// instead of eagerly fetching all manifests for every invocation.
async function main() {
  const args = process.argv.slice(2);
  const maybeSlug = args.find((a) => !a.startsWith("-"));
  const knownTopLevel = new Set(["apps", "help"]);

  program.parseOptions(args);

  if (maybeSlug && !knownTopLevel.has(maybeSlug)) {
    try {
      const manifest = await fetchAppManifest(getCtx(), maybeSlug);
      program.addCommand(buildAppCommand(manifest, getCtx));
    } catch {
      // Not a known app slug — let commander report the error normally.
    }
  }

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
