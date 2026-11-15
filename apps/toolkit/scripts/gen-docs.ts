#!/usr/bin/env tsx
import { writeManifestArtifacts } from "@twodb/core-platform/manifest";
import { writeCliArtifacts } from "@twodb/core-platform/cli";
import { writeMessagesArtifacts } from "@twodb/core-async/registry";
import manifest from "../src/manifest.js";
import messages from "../src/messages.js";
import { toolkitCli as cli } from "../src/cli.js";

async function main() {
  await writeManifestArtifacts(manifest, ".");
  await writeCliArtifacts(cli, ".");
  await writeMessagesArtifacts(messages, ".");
  console.log("Wrote ENDPOINTS.md / MESSAGES.md / endpoint.json / cli.json / messages.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
