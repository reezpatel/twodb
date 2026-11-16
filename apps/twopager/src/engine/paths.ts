import { HttpError } from "../lib/http.js";

/** Config file at the root of a zip / version (firebase.json equivalent). Never served. */
export const CONFIG_FILE = "twopager.json";

/** Normalizes a client-supplied file path to the stored form: no leading slash, no `..`, `/` separators. */
export function normalizeFilePath(input: string): string {
  const p = input.replace(/^\/+/, "");
  if (!p || p.length > 512) throw new HttpError(400, "bad_path", `invalid file path: "${input.slice(0, 80)}"`);
  if (p.includes("\\") || p.includes("\0") || /[\u0000-\u001f]/.test(p)) throw new HttpError(400, "bad_path", `invalid characters in path: "${input.slice(0, 80)}"`);
  const parts = p.split("/");
  if (parts.some((s) => s === "" || s === "." || s === "..")) throw new HttpError(400, "bad_path", `invalid path segment in: "${input.slice(0, 80)}"`);
  return parts.join("/");
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8", map: "application/json; charset=utf-8", webmanifest: "application/manifest+json; charset=utf-8",
  txt: "text/plain; charset=utf-8", md: "text/markdown; charset=utf-8", csv: "text/csv; charset=utf-8", xml: "application/xml; charset=utf-8",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", ico: "image/x-icon", bmp: "image/bmp",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", eot: "application/vnd.ms-fontobject",
  pdf: "application/pdf", zip: "application/zip", wasm: "application/wasm",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", rss: "application/rss+xml; charset=utf-8", atom: "application/atom+xml; charset=utf-8",
};

export function guessContentType(filePath: string): string {
  const base = filePath.split("/").pop() ?? "";
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
  return TYPES[ext] ?? "application/octet-stream";
}

export function isTextType(contentType: string): boolean {
  return /^(text\/|application\/(json|xml|javascript|manifest\+json|rss\+xml|atom\+xml)|image\/svg\+xml)/.test(contentType);
}

/** Header values must not carry CR/LF or control characters. */
export function safeHeaderValue(v: string): boolean {
  return !/[\u0000-\u001f\u007f]/.test(v) && v.length <= 2048;
}
