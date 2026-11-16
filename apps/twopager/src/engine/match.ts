import type { SiteConfig } from "./siteconfig.js";

export interface FileEntry {
  path: string;
  sha256: string;
  size: number;
  contentType: string;
}

export type Resolution =
  | { kind: "redirect"; location: string; status: number }
  | { kind: "file"; file: FileEntry; status: 200 | 404 }
  | { kind: "notfound" };

interface Compiled {
  re: RegExp;
  params: string[];
}
const cache = new Map<string, Compiled>();

/** glob -> anchored RegExp. `:name` captures one segment. Exported for tests. */
export function compileGlob(glob: string): Compiled {
  const hit = cache.get(glob);
  if (hit) return hit;
  const params: string[] = [];
  let out = "";
  let braces = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") { i++; out += "(?:.*/)?"; } else out += ".*";
      } else out += "[^/]*";
    } else if (c === "?") out += "[^/]";
    else if (c === "{") { braces++; out += "(?:"; }
    else if (c === "}" && braces > 0) { braces--; out += ")"; }
    else if (c === "," && braces > 0) out += "|";
    else if (c === ":" && /[A-Za-z_]/.test(glob[i + 1] ?? "") && (i === 0 || glob[i - 1] === "/")) {
      let j = i + 1;
      while (j < glob.length && /[A-Za-z0-9_]/.test(glob[j]!)) j++;
      params.push(glob.slice(i + 1, j));
      out += "([^/]+)";
      i = j - 1;
    } else out += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  const compiled = { re: new RegExp(`^${out}$`), params };
  if (cache.size > 2000) cache.clear();
  cache.set(glob, compiled);
  return compiled;
}

export function matchGlob(glob: string, pathname: string): Record<string, string> | null {
  const { re, params } = compileGlob(glob);
  const m = re.exec(pathname);
  if (!m) return null;
  const out: Record<string, string> = {};
  params.forEach((p, i) => { out[p] = m[i + 1] ?? ""; });
  return out;
}

const substitute = (dest: string, params: Record<string, string>) =>
  dest.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (all, name: string) => (name in params ? params[name]! : all));

const toPath = (p: string) => (p.startsWith("/") ? p : `/${p}`);
const fileKey = (p: string) => p.replace(/^\/+/, "");

/** Only same-site paths or http(s) URLs may be redirect targets (no `javascript:` etc.). */
function safeLocation(loc: string): string | null {
  if (loc.startsWith("//")) return null;
  if (loc.startsWith("/")) return loc;
  return /^https?:\/\//i.test(loc) ? loc : null;
}

/**
 * Decides what to serve for `pathname` (decoded, starts with "/", no query) against a version's files.
 * Pure function — the HTTP layer only streams the result.
 */
export function resolveRequest(pathname: string, files: Map<string, FileEntry>, config: SiteConfig, search = ""): Resolution {
  // 1. redirects
  for (const r of config.redirects ?? []) {
    const params = matchGlob(r.source, pathname);
    if (!params) continue;
    const location = safeLocation(substitute(r.destination, params));
    if (location) return { kind: "redirect", location, status: r.type ?? 301 };
  }

  const has = (p: string) => files.get(fileKey(p));

  // 2. clean URLs: /about.html -> /about, /docs/index.html -> /docs/
  if (config.cleanUrls && pathname.endsWith(".html") && has(pathname)) {
    let target = pathname.slice(0, -".html".length);
    if (target.endsWith("/index")) target = target.slice(0, -"index".length);
    return { kind: "redirect", location: (target || "/") + search, status: 301 };
  }

  // 3. trailing slash policy (only for paths that would resolve to a directory index / clean URL)
  const lastSeg = pathname.split("/").pop() ?? "";
  if (config.trailingSlash === true && pathname !== "/" && !pathname.endsWith("/") && !lastSeg.includes(".") && has(`${pathname}/index.html`)) {
    return { kind: "redirect", location: `${pathname}/${search}`, status: 301 };
  }
  if (config.trailingSlash === false && pathname !== "/" && pathname.endsWith("/")) {
    const bare = pathname.replace(/\/+$/, "");
    if (has(`${bare}/index.html`) || (config.cleanUrls && has(`${bare}.html`))) return { kind: "redirect", location: bare + search, status: 301 };
  }

  // 4. static files
  const candidates = pathname.endsWith("/")
    ? [`${pathname}index.html`]
    : [pathname, ...(config.cleanUrls ? [`${pathname}.html`] : []), `${pathname}/index.html`];
  for (const c of candidates) {
    const f = has(c);
    if (f) return { kind: "file", file: f, status: 200 };
  }

  // 5. rewrites (first match wins) — `spa` adds a final catch-all
  const rewrites = [...(config.rewrites ?? []), ...(config.spa ? [{ source: "**", destination: "/index.html" }] : [])];
  for (const r of rewrites) {
    const params = matchGlob(r.source, pathname);
    if (!params) continue;
    const dest = substitute(r.destination, params);
    const f = has(dest) ?? has(dest.endsWith("/") ? `${dest}index.html` : `${dest}/index.html`);
    if (f) return { kind: "file", file: f, status: 200 };
    break; // matched a rewrite whose target is missing -> 404 rather than falling through
  }

  // 6. 404 page
  const nf = has(toPath(config.notFoundPage ?? "404.html"));
  return nf ? { kind: "file", file: nf, status: 404 } : { kind: "notfound" };
}

/** Header rules matching `pathname`, later rules override earlier ones. */
export function headersFor(pathname: string, config: SiteConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of config.headers ?? []) {
    if (!matchGlob(rule.source, pathname)) continue;
    for (const h of rule.headers) out[h.key.toLowerCase()] = h.value;
  }
  return out;
}
