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
  outfile: path.join(outdir, "server.mjs"),
  packages: "bundle",
  external: ["pg-native"],
  banner: {
    js: 'import { createRequire as __cr } from "node:module";const require=__cr(import.meta.url);',
  },
  sourcemap: false,
  metafile: true,
  logLevel: "warning",
});

const bytes = Object.values(result.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
console.log(`built twodb api server -> dist/server.mjs (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
