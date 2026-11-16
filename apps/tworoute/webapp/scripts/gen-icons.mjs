// Generates TwoRoute's PWA icon set + favicon from the fork mark
// (public/icons/tworoute.svg) into public/icons/.
//
// Usage:  node scripts/gen-icons.mjs
// Needs:  nix (uses `nix run nixpkgs#resvg` and `nixpkgs#imagemagick`).
//
// Mark geometry: 96×96 source, stroke 9 — scaled ×4 (stroke 36) into a
// 384×384 box centered on a 512 canvas (offset 64). Fork tips at (168,104)
// and (344,104), stem bottom at (256,416). The mark spans ~52% of the
// canvas — inside the maskable 80% safe zone.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../public/icons");
mkdirSync(OUT, { recursive: true });

const INK = "#1f1c15";
const PAPER = "#faf7f0";
const ION = "#a9c1e8";
const ION_DEEP = "#4f63ad";

const mark = (ink, accent) => `
  <path d="M256 416 V248" stroke="${ink}" stroke-width="36" stroke-linecap="round"/>
  <path d="M256 248 C256 176, 168 176, 168 104" stroke="${accent}" stroke-width="36" stroke-linecap="round"/>
  <path d="M256 248 C256 176, 344 176, 344 104" stroke="${ink}" stroke-width="36" stroke-linecap="round"/>`;

/** Full 512 canvas. variant: "light" (paper bg, ink/ion-deep mark — default),
 * "dark" (ink bg, paper/ion mark). bg: "round" (rounded rect, for `any`
 * icons) or "full" (edge-to-edge, for maskable/apple). */
const canvas = ({ variant = "light", bg = "round", size = 512 } = {}) => {
  const [bgFill, ink, accent] = variant === "dark" ? [INK, PAPER, ION] : [PAPER, INK, ION_DEEP];
  const bgRect =
    bg === "round"
      ? `<rect width="512" height="512" rx="112" fill="${bgFill}"/>`
      : `<rect width="512" height="512" fill="${bgFill}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}" fill="none">${bgRect}${mark(ink, accent)}</svg>`;
};

function resvg(svg, out, size) {
  const tmp = join(OUT, ".tmp-icon.svg");
  writeFileSync(tmp, svg);
  execFileSync("nix", ["run", "nixpkgs#resvg", "--", "--width", String(size), "--height", String(size), tmp, out], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  return out;
}

const jobs = [
  // PWA `any` icons — rounded paper tile.
  ["icon-192.png", canvas({ bg: "round" }), 192],
  ["icon-512.png", canvas({ bg: "round" }), 512],
  // Maskable — full-bleed (platform applies the mask; mark is in safe zone).
  ["icon-maskable-192.png", canvas({ bg: "full" }), 192],
  ["icon-maskable-512.png", canvas({ bg: "full" }), 512],
  // Apple touch icon — full-bleed (iOS rounds it itself).
  ["apple-touch-icon.png", canvas({ bg: "full" }), 180],
  // Favicons — rounded paper tile so the mark reads on dark browser chrome.
  ["favicon-16.png", canvas({ bg: "round" }), 16],
  ["favicon-32.png", canvas({ bg: "round" }), 32],
  ["favicon-48.png", canvas({ bg: "round" }), 48],
  // Dark tile (taskbar / og fallback / anywhere a dark chip looks better).
  ["icon-dark-512.png", canvas({ variant: "dark", bg: "round" }), 512],
];

for (const [name, svg, size] of jobs) {
  resvg(svg, join(OUT, name), size);
  console.log("wrote", name);
}

// favicon.ico (16+32+48) via imagemagick.
execFileSync(
  "nix",
  [
    "run", "nixpkgs#imagemagick", "--",
    join(OUT, "favicon-16.png"), join(OUT, "favicon-32.png"), join(OUT, "favicon-48.png"),
    join(OUT, "..", "..", "public", "favicon.ico"),
  ],
  { stdio: "inherit" },
);
console.log("wrote favicon.ico");

// OpenGraph image (1200×630): dark chip with the light-mark centered.
{
  const tile = canvas({ variant: "dark", bg: "round" });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" fill="none">
  <rect width="1200" height="630" fill="${PAPER}"/>
  <g transform="translate(429 34) scale(0.65625)">${tile.replace(/<svg[^>]*>/, "").replace("</svg>", "")}</g>
</svg>`;
  const tmp = join(OUT, ".tmp-og.svg");
  writeFileSync(tmp, svg);
  execFileSync("nix", ["run", "nixpkgs#resvg", "--", "--width", "1200", "--height", "630", tmp, join(OUT, "og.png")], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  console.log("wrote og.png");
}
