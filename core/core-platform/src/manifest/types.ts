import type { ZodType } from "zod";

export type AuthRequirement = "public" | "session" | "apiKey" | "session-or-apiKey";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointSpec {
  /** Unique within the app, e.g. "listThreads". Used as the CLI command name. */
  name: string;
  method: HttpMethod;
  /** Path relative to the app's base path, e.g. "/threads/:id". */
  path: string;
  auth: AuthRequirement;
  description: string;
  /** Zod schema for path params + query string, combined. */
  request?: ZodType;
  /** Zod schema for the JSON response body. */
  response?: ZodType;
  /** Manifest capability this endpoint implements, e.g. "search". */
  capability?: string;
  /** Other apps known to call this endpoint (purely documentary). */
  consumedBy?: string[];
  /** True if the response is a streamed (chunked/SSE) body, not a single JSON payload. */
  streaming?: boolean;
}

export type AppShape = "backend" | "backend+webapp";

export interface AppManifestSpec {
  name: string;
  slug: string;
  version: string;
  shape: AppShape;
  description: string;
  /** Capabilities this app declares to the Gateway/registry, e.g. ["search"]. */
  capabilities: string[];
  /** Core libraries this app depends on, purely documentary (also checked against package.json in CI later). */
  coreDeps: string[];
  /** Base path the Gateway mounts this app under, e.g. "/apps/twomail". */
  basePath: string;
  endpoints: EndpointSpec[];
  /**
   * Paths (relative to basePath, `:param` segments allowed) that accept WebSocket
   * upgrades. The Gateway only bridges upgrades for paths declared here.
   */
  websocketPaths?: string[];
}

export function defineEndpoint(spec: EndpointSpec): EndpointSpec {
  return spec;
}

export function defineAppManifest(spec: AppManifestSpec): AppManifestSpec {
  return spec;
}
