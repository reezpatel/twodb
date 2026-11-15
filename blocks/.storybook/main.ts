import type { StorybookConfig } from "@storybook/react-vite";
import * as path from "node:path";
import * as fs from "node:fs";

/**
 * ONE Storybook for the whole repo, hosted by blocks (which owns the UI
 * toolchain). The stories glob sweeps every app webapp too, so a single
 * `pnpm storybook` (root script) renders blocks + all app stories in one
 * sidebar on one port (6520).
 *
 * Apps therefore do NOT need their own storybook devDeps or scripts — drop
 * a *.stories.tsx under apps/<app>/webapp/src and it shows up here.
 *
 * App stories may use their app's own vite aliases (e.g. paintress's
 * "@shared"). We can't run each app's vite.config here, so apps declare
 * storybook-visible aliases as `storybook.aliases` in their webapp
 * package.json ({ "storybook": { "aliases": { "@shared": "../src/shared" } } })
 * — paths relative to the webapp dir — and they're merged into this
 * config's resolve.alias.
 */
const WEBAPPS_DIR = path.resolve(import.meta.dirname, "../../apps");

function appAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  if (!fs.existsSync(WEBAPPS_DIR)) return aliases;
  for (const app of fs.readdirSync(WEBAPPS_DIR)) {
    const pkgPath = path.join(WEBAPPS_DIR, app, "webapp", "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const declared = pkg?.storybook?.aliases;
      if (!declared) continue;
      for (const [key, rel] of Object.entries(declared as Record<string, string>)) {
        aliases[key] = path.resolve(WEBAPPS_DIR, app, "webapp", rel);
      }
    } catch {
      // malformed package.json — skip this app's aliases
    }
  }
  return aliases;
}

const config: StorybookConfig = {
  stories: [
    "../src/components/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../../apps/*/webapp/src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: ["@storybook/addon-a11y", "@storybook/addon-themes"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteConfig: {
    resolve: { alias: appAliases() },
  },
};

export default config;
