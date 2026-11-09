#!/usr/bin/env tsx
import { writeManifestArtifacts } from "@twodb/core-platform/manifest";
import { writeMessagesArtifacts } from "@twodb/core-async/registry";
import twodbManifest from "../src/manifest.js";
import twodbMessages from "../src/messages.js";

async function main() {
  const { endpointsMdPath } = await writeManifestArtifacts(twodbManifest, ".");
  const { messagesMdPath } = await writeMessagesArtifacts(twodbMessages, ".");
  console.log(`Wrote ${endpointsMdPath}`);
  console.log(`Wrote ${messagesMdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
