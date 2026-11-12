// Icon catalogue served from bundled Iconify sets (no network at runtime).
//   logos  (CC0)        tech brands + 60 AWS service icons (aws-lambda, aws-s3, …)
//   gcp    (Apache-2.0) Google Cloud product icons
//   carbon (Apache-2.0) generic infrastructure (server, queue, user, firewall, …)
//   mdi    (Apache-2.0) general purpose
import { createRequire } from "node:module";
import { getIconData, iconToSVG, iconToHTML, replaceIDs } from "@iconify/utils";
import type { IconifyJSON } from "@iconify/types";

const require = createRequire(import.meta.url);

export const ICON_SETS = [
  { prefix: "logos", name: "Logos (tech + AWS)", license: "CC0" },
  { prefix: "gcp", name: "Google Cloud", license: "Apache-2.0" },
  { prefix: "carbon", name: "Carbon (generic infrastructure)", license: "Apache-2.0" },
  { prefix: "mdi", name: "Material Design Icons", license: "Apache-2.0" },
] as const;

const sets = new Map<string, IconifyJSON>();
for (const s of ICON_SETS) sets.set(s.prefix, require(`@iconify-json/${s.prefix}/icons.json`) as IconifyJSON);

interface Entry {
  id: string;
  set: string;
  name: string;
  tokens: string[];
}
const entries: Entry[] = [];
for (const [set, json] of sets) {
  const names = new Set([...Object.keys(json.icons), ...Object.keys(json.aliases ?? {})]);
  for (const name of names) entries.push({ id: `${set}:${name}`, set, name, tokens: name.split(/[-_]/) });
}

export function hasIcon(id: string): boolean {
  const [set, name] = id.split(":");
  const json = set ? sets.get(set) : undefined;
  return !!json && !!name && (name in json.icons || name in (json.aliases ?? {}));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function searchIcons(query: string, opts: { set?: string; limit?: number } = {}): { id: string; set: string; name: string }[] {
  const q = norm(query);
  const words = q.split(" ").filter(Boolean);
  if (!words.length) return [];
  const joined = words.join("-");
  const scored: { e: Entry; score: number }[] = [];
  for (const e of entries) {
    if (opts.set && e.set !== opts.set) continue;
    const n = e.name;
    let score = 0;
    if (n === joined) score = 100;
    else if (n === `aws-${joined}` || n === `${joined}-icon`) score = 95;
    else if (n.startsWith(joined)) score = 80;
    else if (words.every((w) => e.tokens.some((t) => t === w))) score = 70;
    else if (words.every((w) => n.includes(w))) score = 50;
    else continue;
    // Prefer brand/cloud sets over generic ones, shorter names over longer.
    score += e.set === "logos" ? 6 : e.set === "gcp" ? 5 : e.set === "carbon" ? 3 : 0;
    score -= n.length * 0.05;
    scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, opts.limit ?? 20).map(({ e }) => ({ id: e.id, set: e.set, name: e.name }));
}

/** Accepts "logos:aws-lambda" or a loose phrase ("aws lambda"); returns a real icon id or undefined. */
export function resolveIcon(input: string | undefined): string | undefined {
  if (!input) return undefined;
  if (hasIcon(input)) return input;
  return searchIcons(input, { limit: 1 })[0]?.id;
}

export function iconSvg(set: string, name: string, color?: string): string | undefined {
  const json = sets.get(set);
  if (!json) return undefined;
  const data = getIconData(json, name);
  if (!data) return undefined;
  const r = iconToSVG(data, { height: "auto" });
  const body = replaceIDs(r.body);
  const svg = iconToHTML(body, r.attributes);
  // Monochrome sets use currentColor; give them a concrete colour so <img> renders.
  return svg.replace(/currentColor/g, color ?? "#334155");
}
