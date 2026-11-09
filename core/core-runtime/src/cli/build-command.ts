import { Command } from "commander";
import type { EndpointJson, EndpointJsonEndpoint } from "./types.js";
import { callEndpoint, type CliContext } from "./registry-client.js";

function pathParamNames(path: string): string[] {
  return (path.match(/:([a-zA-Z0-9_]+)/g) ?? []).map((p) => p.slice(1));
}

function substitutePath(path: string, values: Record<string, string>): string {
  return path.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
    const v = values[name];
    if (v === undefined) throw new Error(`missing required path param --${name}`);
    return encodeURIComponent(v);
  });
}

/** Builds one commander subcommand per endpoint declared in an app's endpoint.json. */
export function buildAppCommand(manifest: EndpointJson, getCtx: () => CliContext): Command {
  const appCmd = new Command(manifest.slug).description(manifest.description);

  for (const endpoint of manifest.endpoints) {
    appCmd.addCommand(buildEndpointCommand(manifest, endpoint, getCtx));
  }

  return appCmd;
}

function buildEndpointCommand(
  manifest: EndpointJson,
  endpoint: EndpointJsonEndpoint,
  getCtx: () => CliContext,
): Command {
  const cmd = new Command(endpoint.name).description(
    `${endpoint.description} (${endpoint.method} ${endpoint.path}, auth: ${endpoint.auth})`,
  );

  for (const param of pathParamNames(endpoint.path)) {
    cmd.requiredOption(`--${param} <value>`, `path param: ${param}`);
  }
  cmd.option("--query <key=value...>", "extra query string params", collectKv, {});
  cmd.option("--data <json>", "JSON request body");
  cmd.option("--data-stdin", "read JSON request body from stdin");

  cmd.action(async (opts) => {
    const ctx = getCtx();
    const pathParams: Record<string, string> = {};
    for (const param of pathParamNames(endpoint.path)) pathParams[param] = opts[param];

    let body: unknown;
    if (opts.dataStdin) {
      body = JSON.parse(await readStdin());
    } else if (opts.data) {
      body = JSON.parse(opts.data);
    }

    const res = await callEndpoint(ctx, {
      method: endpoint.method,
      path: substitutePath(endpoint.path, pathParams),
      query: opts.query,
      body,
      streaming: endpoint.streaming,
      basePath: manifest.basePath,
    });

    if (!res.ok && !endpoint.streaming) {
      process.stderr.write(`error: ${res.status} ${await res.text()}\n`);
      process.exitCode = 1;
      return;
    }

    if (endpoint.streaming && res.body) {
      for await (const chunk of res.body as any) {
        process.stdout.write(chunk);
      }
      return;
    }

    const text = await res.text();
    try {
      process.stdout.write(JSON.stringify(JSON.parse(text), null, 2) + "\n");
    } catch {
      process.stdout.write(text + "\n");
    }
  });

  return cmd;
}

function collectKv(value: string, previous: Record<string, string>): Record<string, string> {
  const [k, ...rest] = value.split("=");
  return { ...previous, [k]: rest.join("=") };
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}
