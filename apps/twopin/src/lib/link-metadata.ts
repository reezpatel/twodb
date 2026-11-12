import * as dns from "node:dns/promises";
import * as net from "node:net";
import * as cheerio from "cheerio";

/**
 * Server-side link metadata fetcher. Given a user-submitted URL it fetches
 * the HTML (bounded), extracts Open Graph / Twitter Card / classic <meta>
 * fields, then downloads the preview image (og:image) and favicon so the UI
 * never hotlinks third-party origins.
 *
 * Guards: http(s) only, private/loopback IPs rejected (basic SSRF
 * protection), redirect hops re-validated, hard timeouts + byte caps.
 */

const HTML_CAP_BYTES = 2 * 1024 * 1024; // 2 MB of HTML is plenty for <head>
const IMAGE_CAP_BYTES = 5 * 1024 * 1024;
const FAVICON_CAP_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

const UA =
  "Mozilla/5.0 (compatible; TwoPinBot/1.0; +https://twopin.local) " +
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface LinkMetadata {
  finalUrl: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  image: Buffer | null;
  imageContentType: string | null;
  favicon: Buffer | null;
  faviconContentType: string | null;
}

export class FetchError extends Error {}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) || // link-local (cloud metadata endpoints live here)
      a === 0 ||
      a >= 224 // multicast/reserved
    );
  }
  const norm = ip.toLowerCase();
  return (
    norm === "::1" ||
    norm === "::" ||
    norm.startsWith("fc") ||
    norm.startsWith("fd") ||
    norm.startsWith("fe80") ||
    norm.startsWith("::ffff:") && isPrivateIp(norm.slice(7)) // v4-mapped
  );
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError(`unsupported protocol "${url.protocol}" (http/https only)`);
  }
  const host = url.hostname;
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new FetchError("refusing to fetch a private/loopback address");
    return;
  }
  let addrs: string[];
  try {
    addrs = (await dns.lookup(host, { all: true })).map((a) => a.address);
  } catch {
    throw new FetchError(`could not resolve host "${host}"`);
  }
  if (addrs.length === 0 || addrs.some(isPrivateIp)) {
    throw new FetchError("refusing to fetch a private/loopback address");
  }
}

/** Bounded fetch: timeout + byte cap, returns the body as a Buffer. */
async function boundedFetch(url: URL, capBytes: number, accept: string): Promise<{ body: Buffer; contentType: string; finalUrl: URL }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        signal: ctrl.signal,
        redirect: "manual",
        headers: {
          "user-agent": UA,
          accept,
          "accept-language": "en-US,en;q=0.9",
        },
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") throw new FetchError("fetch timed out");
      throw new FetchError(`fetch failed: ${(err as Error).message}`);
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new FetchError(`redirect (${res.status}) without Location header`);
      current = new URL(location, current);
      continue;
    }
    if (!res.ok) throw new FetchError(`target responded with HTTP ${res.status}`);

    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > capBytes) throw new FetchError(`response too large (${Math.round(length / 1024)} KB)`);
    if (!res.body) throw new FetchError("empty response body");

    const chunks: Buffer[] = [];
    let total = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > capBytes) {
        await reader.cancel().catch(() => {});
        throw new FetchError(`response too large (>${Math.round(capBytes / 1024)} KB)`);
      }
      chunks.push(Buffer.from(value));
    }
    return {
      body: Buffer.concat(chunks),
      contentType: (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(),
      finalUrl: current,
    };
  }
  throw new FetchError(`too many redirects (>${MAX_REDIRECTS})`);
}

function firstAttr($: cheerio.CheerioAPI, selectors: string[], attr: string): string | null {
  for (const sel of selectors) {
    const v = $(sel).first().attr(attr);
    if (v?.trim()) return v.trim();
  }
  return null;
}

function absolutize(maybe: string | null, base: URL): string | null {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return null;
  }
}

async function downloadImage(
  urlStr: string | null,
  capBytes: number,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!urlStr) return null;
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return null;
  }
  try {
    const { body, contentType } = await boundedFetch(url, capBytes, "image/avif,image/webp,image/*,*/*;q=0.8");
    if (contentType && !contentType.startsWith("image/") && contentType !== "application/octet-stream") return null;
    return { bytes: body, contentType: contentType || "application/octet-stream" };
  } catch {
    return null; // images are best-effort — never fail the whole pin over them
  }
}

/** Fetches a page and extracts pin metadata + downloadable assets. Throws FetchError on failure. */
export async function fetchLinkMetadata(rawUrl: string): Promise<LinkMetadata> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new FetchError(`"${rawUrl}" is not a valid URL`);
  }

  const { body, contentType, finalUrl } = await boundedFetch(url, HTML_CAP_BYTES, "text/html,application/xhtml+xml,*/*;q=0.8");
  if (contentType && !contentType.includes("html") && !contentType.includes("text/")) {
    throw new FetchError(`URL is not a web page (content-type: ${contentType})`);
  }

  const html = body.toString("utf8");
  const $ = cheerio.load(html);

  const title =
    firstAttr($, ['meta[property="og:title"]', 'meta[name="twitter:title"]'], "content") ??
    ($("title").first().text().trim() || null);
  const description =
    firstAttr($, ['meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]'], "content");
  const siteName = firstAttr($, ['meta[property="og:site_name"]', 'meta[name="application-name"]'], "content") ?? finalUrl.hostname;
  const imageUrl = absolutize(
    firstAttr($, ['meta[property="og:image"]', 'meta[property="og:image:url"]', 'meta[name="twitter:image"]'], "content"),
    finalUrl,
  );
  const faviconUrl = absolutize(
    firstAttr(
      $,
      ['link[rel="icon"]', 'link[rel="shortcut icon"]', 'link[rel="apple-touch-icon"]', 'link[rel="apple-touch-icon-precomposed"]'],
      "href",
    ) ?? "/favicon.ico",
    finalUrl,
  );

  const [image, favicon] = await Promise.all([
    downloadImage(imageUrl, IMAGE_CAP_BYTES),
    downloadImage(faviconUrl, FAVICON_CAP_BYTES),
  ]);

  return {
    finalUrl: finalUrl.toString(),
    title,
    description,
    siteName,
    image: image?.bytes ?? null,
    imageContentType: image?.contentType ?? null,
    favicon: favicon?.bytes ?? null,
    faviconContentType: favicon?.contentType ?? null,
  };
}
