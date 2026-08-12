# twodb Plugin Architecture — Plan

Status: **implemented (vertical slice)** — workspace packages, core plugins,
shell, and the `twodb.notes` end-to-end slice are built and smoke-tested.
Remaining from §8: step 6 (plugin template generator).
Owner decision points are marked ▸. Everything else is the recommended default.

## 1. Goal

The React app (`apps/web`) becomes a thin **shell**. Every product feature — notes,
chat, automations, AI, settings — ships as a **plugin**. One plugin = one package
with two halves:

- **`view/`** — the React half, installed into the shell via **react-pluggable**.
- **`service/`** — the Fastify half (better name than "backend": `view`/`service`
  reads as a pair; "server" collides with the api host, "api" collides with
  `apps/api`, "core" is ambiguous), registered into the api host as a Fastify
  plugin.

Cross-plugin communication is **event-bus-first** on both sides, with a typed
contracts package so both buses speak the same language.

Every plugin carries a **unique dot-namespaced identifier** (`twodb.notes`,
`twodb.chat`) that is the single collision-free key for everything the plugin
touches — API prefix, frontend route prefix, event names, function namespaces,
decorators, manifest (see §2, "Plugin identifiers").

## 2. Repository layout

```text
twodb/
├── apps/
│   ├── web/                      # React SHELL (host) — no features of its own
│   │   └── src/
│   │       ├── main.tsx          # boot: ui styles imported ONCE here
│   │       ├── plugins.ts        # static view-plugin registry (install list)
│   │       └── shell/            # AppShell: rail/panel/main slots, router outlet
│   ├── api/                      # Fastify HOST — no features of its own
│   │   └── src/
│   │       ├── index.ts          # boot: env, dbs, bus, auth, realtime, services
│   │       ├── plugins.ts        # static service-plugin registry
│   │       └── db/               # postgres.js, memgraph.js (core, already exist)
│   └── ui-library/               # component showcase (dev tool, unchanged)
│
├── packages/
│   ├── ui/                       # @twodb/ui — components + styles.css (source-consumed)
│   ├── contracts/                # @twodb/contracts — DTOs + event maps (pure types)
│   ├── shared-frontend/          # @twodb/shared-frontend — view-side kit
│   └── shared-backend/           # @twodb/shared-backend — service-side kit
│
└── plugins/
    ├── notes/
    │   ├── package.json          # @twodb/plugin-notes — exports: ./view, ./service
    │   ├── manifest.ts           # id, name, version, capabilities, events
    │   ├── view/                 # React: plugin class, screens, components
    │   │   ├── index.ts          # default export: IPlugin class
    │   │   ├── routes.tsx
    │   │   └── ...
    │   └── service/              # Fastify: routes + bus subscriptions
    │       ├── index.ts          # default export: fastify plugin (fp-wrapped)
    │       └── routes/
    ├── chat/
    └── automations/
```

`pnpm-workspace.yaml` gains one line: `- "plugins/*"`.

### Why one package per plugin (not two)

`view/` and `service/` have disjoint dependency sets (react/lucide vs fastify/pg)
and disjoint consumers (vite vs node), but they are **one feature** — versioned,
renamed, and deleted together. One package with subpath exports keeps the feature
self-contained:

```jsonc
// plugins/notes/package.json
{
  "name": "@twodb/plugin-notes",
  "type": "module",
  "exports": {
    "./view":    "./view/index.ts",
    "./service": "./service/index.ts"
  },
  "peerDependencies": {
    "@twodb/ui": "workspace:*",
    "react": "^19.0.0",
    "fastify": "^5.0.0"
  }
}
```text

Consumers only ever import the half they need, so fastify code can never leak
into the web bundle and react code can never leak into the api process.

### Plugin identifiers

Each plugin declares one globally-unique identifier: **lowercase alphanumeric
segments joined by dots**, validated at boot against
`^[a-z][a-z0-9]*(\.[a-z0-9]+)*$` — e.g. `twodb.notes`, `twodb.chat`,
`twodb.automations`. First-party plugins live under the `twodb.*` namespace;
the dotted form leaves room for future third-party plugins (`acme.crm`) without
ever colliding with ours or each other.

The identifier is the **only** name a plugin has, reused verbatim everywhere:

| Where | Shape | Example |
| --- | --- | --- |
| API routes | `/api/v1/<plugin_id>/<plugin_routes>` | `GET /api/v1/twodb.notes/notes/:id` |
| Frontend routes | `/<plugin_id>/<plugin_routes>` | `/twodb.notes/inbox` |
| Bus events | `<plugin_id>.<noun>.<verb-past>` | `twodb.notes.note.created` |
| Exposed functions | `<plugin_id>.<verb>` | `twodb.notes.getById` |
| Fastify decorators | `fastify.plugin("<plugin_id>")` helper | `fastify.plugin("twodb.notes")` |
| Manifest `id` | the identifier itself | `id: "twodb.notes"` |

A plugin never hardcodes its own prefix: the shell and the api host mount view
routes and service routes under the identifier automatically, and
`apiClient`/`fetch` helpers in the shared kits build URLs from it.

## 3. The three shared packages

The user ask named two shared libs; a small third one is required so neither
side has to import the other's kitchen sink just to get types.

| Package | Runtime | Contents |
| --- | --- | --- |
| `@twodb/contracts` | none (types + zod schemas only) | API DTOs, `FrontendEventMap`, `BackendEventMap`, event-name constants, permission/capability enums |
| `@twodb/shared-frontend` | browser | `ViewPlugin` base class, typed `useBus()` hooks, slot-name constants, `apiClient` (typed fetch), route/slot contribution helpers |
| `@twodb/shared-backend` | node | `defineService()` factory, `busPlugin` (decorates `fastify.bus`), shared-context typings (`fastify.db`, `fastify.config`, `fastify.user`), auth hook, realtime (SSE) bridge |

**contracts is pure types/schemas** — no runtime deps — so both halves of every
plugin (and both hosts) can import it freely without bundle contamination.

### Event maps live in contracts

```ts
// packages/contracts/src/events.ts
export interface BackendEventMap {
  "twodb.notes.note.created":   { noteId: string; ownerId: string };
  "twodb.chat.message.sent":    { threadId: string; messageId: string };
  "twodb.ai.run.completed":     { runId: string; outputRef: string };
}
export interface FrontendEventMap {
  "twodb.notes.note.selected":  { noteId: string };
  "twodb.shell.phase.changed":  { phase: "day" | "night" };
}
```

Both buses are thin typed wrappers over an emitter (mitt / node EventEmitter):

```ts
emit<K extends keyof BackendEventMap>(e: K, payload: BackendEventMap[K]): void
```text

Event naming convention: **`<plugin_id>.<noun>.<verb-past>`**
(`twodb.notes.note.created`). Events are facts, not commands. Commands go
through direct calls (below).

## 4. Frontend — how a view plugin works

### 4.1 Boot sequence (shell)

```ts
// apps/web/src/main.tsx
import "@twodb/ui/styles.css";            // ← the ONLY ui-css import in the repo
import { PluginStore } from "react-pluggable";
import { createBusPlugin, createApiPlugin } from "@twodb/shared-frontend";
import { AppShell } from "./shell/AppShell";
import { viewPlugins } from "./plugins";

const store = new PluginStore();
store.install(createBusPlugin());          // core: typed event bus
store.install(createApiPlugin());          // core: typed /api client + SSE bridge
store.install(createShellPlugin());        // core: slots, routes, phase, auth
for (const p of viewPlugins) store.install(p);

createRoot(document.getElementById("root")!).render(
  <PluginProvider pluginStore={store}><AppShell /></PluginProvider>
);
```

### 4.2 A view plugin

```ts
// plugins/notes/view/index.ts
import type { IPlugin, PluginStore } from "react-pluggable";

export default class NotesViewPlugin implements IPlugin {
  namespaces = ["twodb.notes"];
  getPluginName() { return "twodb.notes@1.0.0"; }
  getDependencies() { return []; }

  init(store: PluginStore) { this.store = store; }

  activate() {
    const shell = this.store.executeFunction("twodb.shell.contribute", {
      railItem:  { id: "twodb.notes", icon: NotebookPen, label: "Notes", order: 10 },
      // the shell mounts these under /twodb.notes/* automatically
      routes:    [{ path: "/inbox", element: <NotesScreen /> }],
      settings:  [{ section: "Notes", element: <NotesSettings /> }],
    });
    this.store.bus.on("twodb.shell.phase.changed", /* ... */);
  }

  deactivate() {}
}
```text

### 4.3 Shell extension points (slots)

The shell owns the frame and a small set of **named contribution points**,
registered by the core shell plugin:

| Contribution | Where it lands |
| --- | --- |
| `railItem` | NavRail icon (order-sorted) |
| `routes` | Shell's router outlet (shell owns the single router) |
| `panelSection` | NavPanel content when the plugin's rail item is active |
| `settings` | A section in the Settings surface |
| `command` | Command palette (⌘K) entries |

▸ Decision: react-pluggable's stock `RendererPlugin` (`add("slot", component)`)
vs one typed `shell.contribute(...)` function. Recommendation: **`shell.contribute`**
— one typed call, contributions are data (validated, ordered, revocable on
deactivate), and we avoid stringly-typed slot names scattered across plugins.
RendererPlugin stays available underneath for anything ad-hoc.

### 4.4 View ↔ view communication

1. **Event bus (default)** — loose coupling, facts only:
   `bus.emit("twodb.notes.note.selected", { noteId })`.
2. **Functions** — when a view needs another plugin's *capability*, the provider
   exposes a function via react-pluggable
   (`store.addFunction("twodb.search.query", fn)`), consumers call
   `store.executeFunction("twodb.search.query", args)`. Function names are
   prefixed with the provider's identifier, declared in its `manifest.ts`, and
   typed in contracts.
3. **Never** deep-import another plugin's components or internals.

### 4.5 View ↔ service communication

- **REST** under `/api/v1/<plugin_id>/…` through the shared typed `apiClient`
  (the client prepends `/api/v1/<plugin_id>` — plugins write only their own
  route paths), with request/response DTOs imported from `@twodb/contracts`.
- **Server push**: the api host exposes one SSE endpoint (`/api/v1/events`) via
  a core realtime plugin; the frontend api-plugin subscribes once and re-emits
  matching events onto the **frontend bus**. To a view plugin, a backend fact
  (`twodb.chat.message.sent`) arrives exactly like a local one.
  ▸ SSE chosen over WebSocket: server→client dominates; client→server is plain
  HTTP. Revisit only if we add collaborative editing.

## 5. Backend — how a service plugin works

### 5.1 Boot sequence (api host)

```ts
// apps/api/src/index.ts  (api moves to TS via tsx in dev; see §8)
const app = Fastify({ logger: true });
await app.register(fastifyEnv, { schema: envSchema, dotenv: { path: … } });
await app.register(postgresPlugin);        // existing
await app.register(memgraphPlugin);        // existing
await app.register(busPlugin);             // shared-backend: fastify.bus
await app.register(authPlugin);            // fastify.user on every request
await app.register(realtimePlugin);        // GET /api/v1/events (SSE fan-out)

for (const service of servicePlugins) {
  // host mounts every service under its unique identifier
  await app.register(service, { prefix: `/api/v1/${service.id}` });
}
```

### 5.2 A service plugin

```ts
// plugins/notes/service/index.ts
import fp from "fastify-plugin";
import { defineService } from "@twodb/shared-backend";

export default fp(defineService({
  id: "twodb.notes",
  dependencies: [],                       // other plugin ids, boot-ordered
  async register(fastify) {
    fastify.get("/notes",      listNotes);     // → GET /api/v1/twodb.notes/notes
    fastify.post("/notes",     createNote);    // → POST /api/v1/twodb.notes/notes
    fastify.get("/notes/:id",  getNote);       // → GET /api/v1/twodb.notes/notes/:id

    fastify.bus.on("twodb.ai.run.completed", async ({ runId, outputRef }) => {
      // react to other plugins' facts
    });
  },
}));
```text

### 5.3 Shared Fastify context

Core plugins decorate the **root** instance with `fastify-plugin` (fp), so every
service (a child scope) inherits them:

| Decoration | Provided by | Used for |
| --- | --- | --- |
| `fastify.config` | `@fastify/env` | env/flags |
| `fastify.db.pg` / `fastify.db.graph` | existing db plugins | data access |
| `fastify.bus` | shared-backend busPlugin | typed backend events |
| `fastify.user` | core auth plugin | request identity |
| `fastify.log` | fastify | per-plugin child logger (`fastify.log.child({ plugin: "twodb.notes" })`) |

### 5.4 Service ↔ service communication

1. **Event bus (default)** — `fastify.bus.emit("twodb.notes.note.created", …)`.
2. **Decorators for direct capabilities** — a service may expose synchronous
   access at its identifier key (`fastify.plugin("twodb.notes").getById(...)`,
   backed by `fastify.decorate`). Prefer the bus; decorators are for genuine
   hard dependencies, which must then be declared in `dependencies` so boot
   order is deterministic.
3. **Realtime fan-out** — the realtime plugin subscribes to a whitelist of
   backend events (declared in contracts) and pushes them to SSE clients.

## 6. The ui-library / CSS rule

Mechanics and enforcement for "plugin CSS is never duplicated":

- `@twodb/ui` is **source-consumed** (its `exports` point at `src/`), so there is
  no build artifact to copy — vite includes any module exactly once per bundle.
- **`apps/web/src/main.tsx` is the only file allowed to
  `import "@twodb/ui/styles.css"`** (it also pulls the fontsource CSS via
  `@twodb/ui` index). View plugins import components only:
  `import { Button } from "@twodb/ui"` — never the stylesheet path.
- If plugins are ever prebuilt instead of source-consumed, `@twodb/ui` stays a
  `peerDependency` + bundler-external, so the rule survives that change too.
- Enforcement: an ESLint `no-restricted-imports` rule in view packages banning
  `@twodb/ui/styles.css`, plus the convention documented here.

## 7. Plugin manifest

`plugins/notes/manifest.ts` — one declarative file per plugin, imported by both
halves and by host registries:

```ts
export default {
  id: "twodb.notes",
  name: "@twodb/plugin-notes",
  version: "1.0.0",
  provides: { functions: ["twodb.notes.getById"], routes: ["/api/v1/twodb.notes"] },
  emits:  ["twodb.notes.note.created", "twodb.notes.note.selected"],
  consumes: ["twodb.ai.run.completed"],
  permissions: ["twodb.notes:read", "twodb.notes:write"],
} as const;
```

This is the documentation of the plugin's surface: what it needs, what it
offers, what it says. Later it can drive a plugin manager UI (enable/disable)
and boot-order validation.

## 8. Implementation sequence (for the build phase)

1. **Workspace prep** — add `plugins/*` to `pnpm-workspace.yaml`; scaffold
   `packages/contracts`, `packages/shared-frontend`, `packages/shared-backend`.
2. **api → TS** — convert `apps/api` to TypeScript, run with `tsx` in dev
   (prod build: `tsup` single bundle, services external-source like today).
3. **Core backend** — busPlugin, realtimePlugin (SSE), auth stub.
4. **Core frontend** — bus/api/shell core plugins; AppShell with rail + outlet;
   migrate the existing demo content out of `apps/web`.
5. **First vertical slice** — `plugins/notes` end-to-end: view (rail item +
   route + panel) ↔ contracts ↔ service (CRUD routes + bus events) ↔ SSE back
   into the frontend bus.
6. **Then** chat, automations follow the same template; write a
   `plugins/_template/` generator once the slice proves the shape.

## 9. Hard rules (the constitution)

1. Features live only in `plugins/`; hosts own boot, frame, and core services.
2. Cross-plugin facts travel on the bus; direct calls are declared functions/
   decorators, never deep imports.
3. Every cross-boundary message (HTTP DTO, bus payload) is typed in
   `@twodb/contracts` — no ad-hoc shapes.
4. ui CSS is imported exactly once, by the web shell.
5. A plugin's `view/` never imports fastify; its `service/` never imports react.
6. Every plugin has exactly one dot-namespaced identifier (`twodb.notes`),
   boot-validated, used verbatim for API prefix, frontend route prefix, events,
   functions, and decorators — plugins never hardcode their own prefixes.
7. Event names follow `<plugin_id>.<noun>.<verb-past>`; events are facts.
