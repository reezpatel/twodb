#!/usr/bin/env tsx
import { writeManifestArtifacts } from "@twodb/core-platform/manifest";
import { writeMessagesArtifacts } from "@twodb/core-async/registry";
import manifest from "../src/manifest.js";
import messages from "../src/messages.js";

async function main() {
  await writeManifestArtifacts(manifest, ".");
  await writeMessagesArtifacts(messages, ".");
  console.log("Wrote ENDPOINTS.md / MESSAGES.md / endpoint.json / messages.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
