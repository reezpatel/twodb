import { z } from "zod";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { AppManifestSpec, EndpointSpec } from "./types.js";

function schemaToJsonSchema(schema: unknown): unknown {
  if (!schema) return undefined;
  try {
    // zod v4 ships a native JSON Schema converter.
    return z.toJSONSchema(schema as z.ZodType, { target: "draft-7" });
  } catch (err) {
    return { note: "could not convert schema to JSON Schema", error: String(err) };
  }
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
  websocketPaths?: string[];
  endpoints: Array<{
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
  }>;
}

export function toEndpointJson(manifest: AppManifestSpec): EndpointJson {
  return {
    name: manifest.name,
    slug: manifest.slug,
    version: manifest.version,
    shape: manifest.shape,
    description: manifest.description,
    capabilities: manifest.capabilities,
    coreDeps: manifest.coreDeps,
    basePath: manifest.basePath,
    generatedAt: new Date().toISOString(),
    websocketPaths: manifest.websocketPaths,
    endpoints: manifest.endpoints.map((e) => ({
      name: e.name,
      method: e.method,
      path: e.path,
      auth: e.auth,
      description: e.description,
      capability: e.capability,
      consumedBy: e.consumedBy,
      streaming: e.streaming,
      request: schemaToJsonSchema(e.request),
      response: schemaToJsonSchema(e.response),
    })),
  };
}

function endpointMarkdown(e: EndpointSpec, json: unknown): string {
  const reqJson = (json as any).endpoints.find((x: any) => x.name === e.name);
  const lines: string[] = [];
  lines.push(`### \`${e.method} ${e.path}\` — ${e.name}`);
  lines.push("");
  lines.push(e.description);
  lines.push("");
  lines.push(`- **Auth**: \`${e.auth}\``);
  if (e.streaming) lines.push(`- **Streaming**: yes (chunked/SSE response)`);
  if (e.capability) lines.push(`- **Capability**: \`${e.capability}\``);
  if (e.consumedBy?.length) lines.push(`- **Known consumers**: ${e.consumedBy.join(", ")}`);
  if (reqJson?.request) {
    lines.push("");
    lines.push("**Request**");
    lines.push("```json");
    lines.push(JSON.stringify(reqJson.request, null, 2));
    lines.push("```");
  }
  if (reqJson?.response) {
    lines.push("");
    lines.push("**Response**");
    lines.push("```json");
    lines.push(JSON.stringify(reqJson.response, null, 2));
    lines.push("```");
  }
  lines.push("");
  return lines.join("\n");
}

export function toEndpointsMarkdown(manifest: AppManifestSpec): string {
  const json = toEndpointJson(manifest);
  const lines: string[] = [];
  lines.push(`# ENDPOINTS.md — ${manifest.name}`);
  lines.push("");
  lines.push(
    "> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` " +
      "(Zod schemas). Regenerate with `pnpm gen:docs`.",
  );
  lines.push("");
  lines.push(manifest.description);
  lines.push("");
  lines.push(`- **Shape**: ${manifest.shape}`);
  lines.push(`- **Base path (via Gateway)**: \`${manifest.basePath}\``);
  lines.push(`- **Capabilities**: ${manifest.capabilities.length ? manifest.capabilities.join(", ") : "none"}`);
  lines.push(`- **Core deps**: ${manifest.coreDeps.length ? manifest.coreDeps.join(", ") : "none"}`);
  lines.push("");
  lines.push(`_Generated: ${json.generatedAt}_`);
  lines.push("");
  lines.push("## Endpoints");
  lines.push("");
  if (manifest.endpoints.length === 0) {
    lines.push("_No endpoints declared yet._");
  } else {
    for (const e of manifest.endpoints) {
      lines.push(endpointMarkdown(e, json));
    }
  }
  return lines.join("\n");
}

export async function writeManifestArtifacts(
  manifest: AppManifestSpec,
  outDir: string,
): Promise<{ endpointJsonPath: string; endpointsMdPath: string }> {
  await fs.mkdir(outDir, { recursive: true });
  const endpointJsonPath = path.join(outDir, "endpoint.json");
  const endpointsMdPath = path.join(outDir, "ENDPOINTS.md");
  await fs.writeFile(endpointJsonPath, JSON.stringify(toEndpointJson(manifest), null, 2) + "\n", "utf8");
  await fs.writeFile(endpointsMdPath, toEndpointsMarkdown(manifest), "utf8");
  return { endpointJsonPath, endpointsMdPath };
}
