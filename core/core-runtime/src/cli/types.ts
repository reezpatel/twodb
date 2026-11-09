// Mirrors the shape core-platform/manifest's `toEndpointJson()` produces.
// Deliberately duplicated (not imported from @twodb/core-platform) — this is
// a wire contract (what the Gateway serves), not a code dependency.

export interface EndpointJsonEndpoint {
  name: string;
  method: string;
  path: string;
  auth: string;
  description: string;
  capability?: string;
  consumedBy?: string[];
  streaming?: boolean;
  request?: unknown;
  response?: unknown;
}

export interface EndpointJson {
  name: string;
  slug: string;
  version: string;
  shape: string;
  description: string;
  capabilities: string[];
  coreDeps: string[];
  basePath: string;
  generatedAt: string;
  endpoints: EndpointJsonEndpoint[];
}

export interface RegistryAppSummary {
  slug: string;
  name: string;
  basePath: string;
}
