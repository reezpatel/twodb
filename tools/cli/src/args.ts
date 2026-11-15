import type { CliCommandSpec, EndpointJson } from "./types.js";

/** Resolves `{id}`-style placeholders in a string from vars. */
export function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, k: string) => (vars[k] !== undefined ? vars[k]! : whole));
}

/** Path parameter names declared in an endpoint path (`:id` or `{id}` segments). */
export function pathParamsOf(path: string): string[] {
  const params: string[] = [];
  const re = /(?::|\{)(\w+)\}?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path))) if (!params.includes(m[1]!)) params.push(m[1]!);
  return params;
}

/** Top-level property names of an endpoint's JSON schema (request = query + path + body props combined in our manifests). */
export function schemaPropertyNames(schema: unknown): { name: string; type: string; required: boolean; description?: string }[] {
  const s = schema as { type?: string; properties?: Record<string, any>; required?: string[] } | undefined;
  if (!s || s.type !== "object" || !s.properties) return [];
  return Object.entries(s.properties).map(([name, def]) => ({
    name,
    type: String(def?.type ?? "unknown"),
    required: (s.required ?? []).includes(name),
    description: def?.description as string | undefined,
  }));
}

export function describeCliCommand(cmd: CliCommandSpec): string {
  return cmd.description;
}

/** Fallback: every manifest endpoint becomes a named command. */
export function manifestToCommands(manifest: EndpointJson): CliCommandSpec[] {
  return manifest.endpoints.map((e) => ({
    name: e.name,
    description: e.description,
    call: { method: e.method, path: e.path },
  }));
}
