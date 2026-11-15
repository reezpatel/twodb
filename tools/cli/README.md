# twodb

One CLI for every app installed on your [TwoDB](https://github.com/reezpatel/twodb) control plane.

```
npm i -g twodb
```

## Setup

```
twodb auth https://your-twodb.example.com
```

Opens your browser, asks you to confirm, and mints a workspace API key stored in `~/.config/twodb/cli.json` (the raw key never appears again — only its hash is kept server-side).

## Use

```
twodb                          # every installed app, as a command
twodb apps                     # list apps + status
twodb <app> --help             # that app's API as commands
twodb <app> <command> --param k=v
twodb <app> get|post|put|patch|delete <path> [--query k=v] [< body.json]
```

Commands come from two places:

1. **cli.json** — apps can declare a CLI surface (subcommands mapping to their endpoints, list-style commands whose items become invocable ids). Toolkit, for example, exposes its connector tools:

   ```
   twodb tools --list
   twodb tools 01J….list_projects
   twodb tools 01J….list_states --param projectId=…
   ```

2. **endpoint.json fallback** — for apps without a cli.json, every manifest endpoint becomes `twodb <app> <endpointName>`, with path params (`--param id=…`), query params, and JSON bodies (stdin or `--data`) coerced to the endpoint's schema types.

## Config

`~/.config/twodb/cli.json` (or `$XDG_CONFIG_HOME/twodb/cli.json`):

```json
{
  "gateway": "https://your-twodb.example.com",
  "apiKey": "twodb_…",
  "auth": { "user": "you@example.com", "workspace": "Personal" }
}
```

`twodb auth status` / `twodb auth logout` / `twodb auth api-key` manage it.

## For app authors

Declare a CLI in `src/cli.ts`:

```ts
import { defineAppCli } from "@twodb/core-platform/cli";

export const myCli = defineAppCli({
  slug: "myapp",
  commands: [
    {
      name: "things",
      description: "List things; run one by id",
      call: { method: "GET", path: "/things" },
      listCommand: true,
      idFromList: "id",
      describeItem: "{name} — {description}",
      invoke: { method: "POST", path: "/things/{id}/run", paramsKey: "input" },
    },
  ],
});
```

Generate `cli.json` with `writeCliArtifacts(myCli, ".")` (add it to `gen:docs`), and pass `cli` to `connectTwoDb()` so it's reported at registration. The control plane serves it at `/registry/apps/<slug>/cli.json`.

## Requirements

Node.js ≥ 20. No runtime dependencies.
