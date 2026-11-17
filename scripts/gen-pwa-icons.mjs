// Generates an app's PWA icon set + favicon from its master artwork at
// assets/<app>.png (512×512, opaque, full-bleed).
//
// Usage:  node scripts/gen-pwa-icons.mjs <app> [<app>…]   e.g. dispatch tworoute
// Needs:  nix (uses `nix run nixpkgs#imagemagick`).
//
// - `any` + apple-touch: the artwork edge-to-edge — NO transparent corners
//   (Android paints a white backing behind transparent pixels).
// - maskable: artwork at 80% on the artwork's own background colour, so the
//   platform mask never crops it and the padding is seamless.
// - favicons: rounded tile (browser tabs only).

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BG = "#161617"; // artwork background (all master artwork shares it)
const magick = (args) => execFileSync("nix", ["run", "nixpkgs#imagemagick", "--", ...args], { stdio: "inherit" });

for (const app of process.argv.slice(2)) {
  const SRC = join(ROOT, "assets", `${app}.png`);
  const PUB = join(ROOT, "apps", app, "webapp", "public");
  const OUT = join(PUB, "icons");
  mkdirSync(OUT, { recursive: true });

  const full = (name, size, { round = false } = {}) => {
    const args = [SRC, "-resize", `${size}x${size}`, "-alpha", "off"];
    if (round) {
      const r = Math.round(size * 0.17);
      args.push("(", "-size", `${size}x${size}`, "xc:none", "-fill", "white", "-draw", `roundrectangle 0,0 ${size - 1},${size - 1} ${r},${r}`, ")", "-alpha", "off", "-compose", "CopyOpacity", "-composite");
    }
    magick([...args, join(OUT, name)]);
  };
  const maskable = (name, size) => {
    const inner = Math.round(size * 0.8);
    magick(["-size", `${size}x${size}`, `xc:${BG}`, "(", SRC, "-resize", `${inner}x${inner}`, ")", "-gravity", "center", "-composite", "-alpha", "off", join(OUT, name)]);
  };

  full("icon-192.png", 192);
  full("icon-512.png", 512);
  maskable("icon-maskable-192.png", 192);
  maskable("icon-maskable-512.png", 512);
  full("apple-touch-icon.png", 180);
  for (const s of [16, 32, 48]) full(`favicon-${s}.png`, s, { round: true });
  magick([join(OUT, "favicon-16.png"), join(OUT, "favicon-32.png"), join(OUT, "favicon-48.png"), join(PUB, "favicon.ico")]);
  magick(["-size", "1200x630", `xc:${BG}`, "(", SRC, "-resize", "460x460", ")", "-gravity", "center", "-composite", join(OUT, "og.png")]);
  console.log("generated icons for", app);
}
