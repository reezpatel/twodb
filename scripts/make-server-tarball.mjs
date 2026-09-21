import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tag = process.argv[2];

if (!tag || !/^v\d/.test(tag)) {
  console.error("usage: node scripts/make-server-tarball.mjs <vX.Y.Z tag>");
  process.exit(1);
}

const CORE_PLUGINS = ["auth", "workspace", "llm", "node", "code"];

const run = (command, cwd) => {
  try {
    execSync(command, { cwd, stdio: "inherit" });
  } catch (error) {
    console.error(`build step failed (${cwd}: ${command}): ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

console.log("building api bundle…");
run("node build.mjs", path.join(root, "apps/api"));

console.log("building vendor deps…");
run("node scripts/vendor-deps.mjs", root);

console.log("building web app…");
run("npx vite build", path.join(root, "apps/web"));

for (const plugin of CORE_PLUGINS) {
  console.log(`building plugin ${plugin}…`);
  run("node build.mjs", path.join(root, "plugins", plugin));
}

const staging = path.join(root, ".work", "release-staging");
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(path.join(staging, "plugins"), { recursive: true });

fs.copyFileSync(path.join(root, "apps/api/dist/server.mjs"), path.join(staging, "server.mjs"));
fs.cpSync(path.join(root, "apps/web/dist"), path.join(staging, "web-dist"), { recursive: true });
fs.cpSync(path.join(root, "apps/api/vendor"), path.join(staging, "vendor"), { recursive: true });
for (const plugin of CORE_PLUGINS) {
  fs.cpSync(path.join(root, "plugins", plugin, ".build"), path.join(staging, "plugins", plugin, ".build"), { recursive: true });
}

fs.writeFileSync(
  path.join(staging, "README.txt"),
  `twodb-server ${tag}\n\nRun with:\n  TWODB_DATABASE_URL=postgres://... TWODB_PLUGINS_DIR=./plugins TWODB_STATIC_DIR=./web-dist TWODB_VENDOR_DIR=./vendor node server.mjs\n`,
);

const outFile = path.join(root, `twodb-server-${tag}.tar.gz`);
try {
  execSync(`tar -czf ${JSON.stringify(outFile)} -C ${JSON.stringify(staging)} .`, { stdio: "inherit" });
} catch (error) {
  console.error(`tar failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
fs.rmSync(staging, { recursive: true, force: true });

const size = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
console.log(`\nbuilt ${path.basename(outFile)} (${size} MB)`);
