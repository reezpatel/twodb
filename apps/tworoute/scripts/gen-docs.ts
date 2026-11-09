#!/usr/bin/env tsx
import { writeManifestArtifacts } from "@twodb/core-platform/manifest";
import { writeMessagesArtifacts } from "@twodb/core-async/registry";
import tworouteManifest from "../src/manifest.js";
import tworouteMessages from "../src/messages.js";

async function main() {
  await writeManifestArtifacts(tworouteManifest, ".");
  await writeMessagesArtifacts(tworouteMessages, ".");
  console.log("Wrote ENDPOINTS.md / MESSAGES.md / endpoint.json / messages.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
