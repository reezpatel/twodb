import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publish = process.argv.includes("--yes");

const groups = [path.join(root, "plugins"), path.join(root, "plugins/llm-adapters")];

const discover = () => {
  const found = [];
  for (const group of groups) {
    for (const entry of fs.readdirSync(group, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(group, entry.name);
      if (dir.includes(`${path.sep}llm-adapters${path.sep}`) && group.endsWith("plugins")) continue;
      const pkgPath = path.join(dir, "package.json");
      if (!fs.existsSync(pkgPath)) continue;
      let pkg;
      try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      } catch {
        continue;
      }
      if (pkg.twodb?.identifier && fs.existsSync(path.join(dir, "build.mjs"))) {
        found.push({ dir, name: pkg.name, version: pkg.version, identifier: pkg.twodb.identifier });
      }
    }
  }
  return found;
};

const registryVersion = (name, version) => {
  try {
    const out = execSync(`npm view ${JSON.stringify(`${name}@${version}`)} version --json`, {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return JSON.parse(out);
  } catch {
    return null;
  }
};

const plugins = discover();
console.log(`discovered ${plugins.length} publishable plugins\n`);

let published = 0;
let skipped = 0;
let failed = 0;

for (const plugin of plugins) {
  const label = `${plugin.name}@${plugin.version} (${plugin.identifier})`;
  const existing = registryVersion(plugin.name, plugin.version);

  if (existing === plugin.version) {
    console.log(`  = ${label} — already on npm, skipping`);
    skipped += 1;
    continue;
  }

  if (!publish) {
    console.log(`  ~ ${label} — would publish`);
    continue;
  }

  try {
    execSync("node build.mjs", { cwd: plugin.dir, stdio: "inherit" });
    execSync(`npm publish ${JSON.stringify(path.join(plugin.dir, ".build"))} --access public`, {
      cwd: root,
      stdio: "inherit",
    });
    console.log(`  + ${label} — published`);
    published += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("E409") || message.includes("cannot publish over existing version")) {
      console.log(`  = ${label} — already on npm (registry race), skipping`);
      skipped += 1;
    } else {
      console.error(`  ! ${label} — FAILED: ${message.slice(0, 200)}`);
      failed += 1;
    }
  }
}

console.log(`\n${publish ? `published ${published}, skipped ${skipped}, failed ${failed}` : `dry run — pass --yes to publish (${plugins.length} plugins)`}`);
if (failed > 0) process.exit(1);
