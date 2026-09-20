import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const outdir = path.join(root, "dist");

await fs.rm(outdir, { recursive: true, force: true });

const result = await build({
  entryPoints: [path.join(root, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: path.join(outdir, "agent.mjs"),
  packages: "bundle",
  sourcemap: true,
  metafile: true,
  logLevel: "warning",
});

const bytes = Object.values(result.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
console.log(`built twodb-node agent -> dist/agent.mjs (${(bytes / 1024).toFixed(1)} kB)`);
