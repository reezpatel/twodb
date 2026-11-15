import type { IncomingMessage } from "node:http";

export interface HostRoutingConfig {
  ROOT_DOMAIN?: string;
  CATCH_ALL_SERVICE?: string;
  CATCH_ALL_HOST_REGEX?: string;
}

const SERVICE_RE = /^[a-z0-9][a-z0-9-]*$/;
const CONTROL_PLANE_HOSTS = new Set(["console", "twodb"]);

function normalizeRootDomain(value: string | undefined): string | null {
  const domain = value?.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  return domain || null;
}

function hostnameFromHostHeader(host: string | undefined): string | null {
  if (!host) return null;
  try {
    return new URL(`http://${host}`).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

/**
 * Maps virtual hosts to the existing /apps/:slug gateway surface.
 *
 * - <slug>.<ROOT_DOMAIN> routes to that registered service.
 * - console.<ROOT_DOMAIN> and twodb.<ROOT_DOMAIN> stay on the control plane.
 * - Non-root-domain hosts route to CATCH_ALL_SERVICE when configured and,
 *   when present, CATCH_ALL_HOST_REGEX matches the hostname.
 * - Everything else is returned unchanged for normal gateway routing.
 *
 * Only the URL is rewritten. The original Host header is deliberately kept
 * intact so apps (especially a catch-all custom-domain service) can inspect it.
 */
export function createHostRouter(config: HostRoutingConfig): (req: Pick<IncomingMessage, "url" | "headers">) => string {
  const rootDomain = normalizeRootDomain(config.ROOT_DOMAIN);
  const catchAllService = config.CATCH_ALL_SERVICE?.trim().toLowerCase() || null;
  if (catchAllService && !SERVICE_RE.test(catchAllService)) {
    throw new Error("CATCH_ALL_SERVICE must be a kebab-case service slug");
  }

  let catchAllHostRegex: RegExp | null = null;
  if (config.CATCH_ALL_HOST_REGEX) {
    try {
      catchAllHostRegex = new RegExp(config.CATCH_ALL_HOST_REGEX);
    } catch (error) {
      throw new Error(`CATCH_ALL_HOST_REGEX is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (req) => {
    const originalUrl = req.url || "/";
    const hostname = hostnameFromHostHeader(req.headers.host);
    if (!hostname) return originalUrl;

    let service: string | null = null;
    let belongsToRootDomain = false;
    if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
      belongsToRootDomain = true;
      const label = hostname.slice(0, -(rootDomain.length + 1));
      // A service host is exactly one DNS label. Reserve the console aliases
      // for TwoDB itself rather than proxying back into the gateway.
      if (!label.includes(".") && SERVICE_RE.test(label) && !CONTROL_PLANE_HOSTS.has(label)) service = label;
    }

    if (!service && !belongsToRootDomain && catchAllService) {
      // Reset lastIndex so stateful /g or /y regexes behave consistently.
      if (catchAllHostRegex) catchAllHostRegex.lastIndex = 0;
      if (!catchAllHostRegex || catchAllHostRegex.test(hostname)) service = catchAllService;
    }

    return service ? `/apps/${service}${originalUrl.startsWith("/") ? originalUrl : `/${originalUrl}`}` : originalUrl;
  };
}

/** True for http(s) origins of the form <label>.<ROOT_DOMAIN> (the console and every app webapp). */
export function isRootDomainOrigin(origin: string, rootDomain: string | undefined): boolean {
  const root = normalizeRootDomain(rootDomain);
  if (!root) return false;
  try {
    const u = new URL(origin);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.toLowerCase().endsWith(`.${root}`);
  } catch {
    return false;
  }
}
