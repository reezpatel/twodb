// Generates TwoRoute's PWA icon set + favicon from the master artwork at
// ../../../assets/tworoute.png (512×512, lavender "R" + bar on #161617).
//
// Usage:  node scripts/gen-icons.mjs
// Needs:  nix (uses `nix run nixpkgs#imagemagick`).
//
// - `any` icons + favicons: rounded tile (transparent corners) so the dark
//   artwork reads as a chip on any background.
// - maskable + apple-touch-icon: full-bleed (the platform applies its own
//   mask; the R sits in the safe zone).

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../public/icons");
const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../../../assets/tworoute.png");
mkdirSync(OUT, { recursive: true });

const magick = (args) => execFileSync("nix", ["run", "nixpkgs#imagemagick", "--", ...args], { stdio: "inherit" });

/** Resize to `size`; when `round` is true, clip to a rounded rect (~17% radius). */
function render(out, size, { round = false } = {}) {
  const args = [SRC, "-resize", `${size}x${size}`];
  if (round) {
    const r = Math.round(size * 0.17);
    args.push("(", "-size", `${size}x${size}`, "xc:none", "-draw", `roundrectangle 0,0 ${size},${size} ${r},${r}`, ")", "-compose", "CopyOpacity", "-composite");
  }
  args.push(out);
  magick(args);
  console.log("wrote", out.split("/").pop());
}

render(join(OUT, "icon-192.png"), 192, { round: true });
render(join(OUT, "icon-512.png"), 512, { round: true });
render(join(OUT, "icon-maskable-192.png"), 192);
render(join(OUT, "icon-maskable-512.png"), 512);
render(join(OUT, "apple-touch-icon.png"), 180);
render(join(OUT, "favicon-16.png"), 16, { round: true });
render(join(OUT, "favicon-32.png"), 32, { round: true });
render(join(OUT, "favicon-48.png"), 48, { round: true });

// favicon.ico (16+32+48).
magick([join(OUT, "favicon-16.png"), join(OUT, "favicon-32.png"), join(OUT, "favicon-48.png"), join(OUT, "..", "..", "public", "favicon.ico")]);
console.log("wrote favicon.ico");

// OpenGraph 1200×630: artwork centered on the dark backdrop.
magick(["-size", "1200x630", "xc:#161617", "(", SRC, "-resize", "460x460", ")", "-gravity", "center", "-composite", join(OUT, "og.png")]);
console.log("wrote og.png");
