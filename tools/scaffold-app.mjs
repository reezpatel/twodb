#!/usr/bin/env node
// One-off scaffolding generator for Phase 0/6: stamps the doc trio
// (AGENTS.md/ENDPOINTS.md/MESSAGES.md), base package.json/tsconfig, and a
// starter manifest.ts/messages.ts + feature-area skeleton for every app
// that hasn't been fully built out yet (everything except twodb/tworoute).
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import * as path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const apps = [
  { slug: "twomail", name: "TwoMail", role: "Mail", shape: "backend+webapp" },
  { slug: "twoday", name: "TwoDay", role: "Calendar", shape: "backend+webapp" },
  { slug: "twocontacts", name: "TwoContacts", role: "Contacts (embeddable)", shape: "backend" },
  { slug: "twochat", name: "TwoChat", role: "Chat/messenger", shape: "backend+webapp" },
  { slug: "twodrive", name: "TwoDrive", role: "Drive/file management", shape: "backend+webapp" },
  { slug: "artisan", name: "Artisan", role: "Coding harness (+headless)", shape: "backend+webapp" },
  { slug: "dispatch", name: "Dispatch", role: "Remote command runner", shape: "backend" },
  { slug: "tworing", name: "TwoRing", role: "Meetings/calls (audio/video)", shape: "backend+webapp" },
  { slug: "garden", name: "Garden", role: "Notes/PKMS", shape: "backend+webapp" },
  { slug: "twothing", name: "TwoThing", role: "Inventory management", shape: "backend+webapp" },
  { slug: "twoloop", name: "TwoLoop", role: "Workflow automation", shape: "backend+webapp" },
  { slug: "membrain", name: "Membrain", role: "Agent harness", shape: "backend" },
  { slug: "paintress", name: "Paintress", role: "Canvas/board", shape: "backend+webapp" },
  { slug: "twopin", name: "TwoPin", role: "Bookmarks/link aggregator", shape: "backend+webapp" },
  { slug: "twodoo", name: "TwoDoo", role: "Tasks/checklists", shape: "backend+webapp" },
];

function write(filePath, content) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  if (existsSync(filePath)) return; // never clobber hand-written content on re-run
  writeFileSync(filePath, content, "utf8");
}

for (const app of apps) {
  const dir = path.join(root, "apps", app.slug);
  const isWebapp = app.shape === "backend+webapp";

  write(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: `@twodb/app-${app.slug}`,
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
          dev: "tsx watch --env-file=../../.env src/index.ts",
          build: "tsc --noEmit",
          start: "tsx src/index.ts",
          "gen:docs": "tsx scripts/gen-docs.ts",
          lint: "tsc --noEmit",
        },
        dependencies: {
          "@twodb/core-data": "workspace:*",
          "@twodb/core-platform": "workspace:*",
          "@twodb/core-async": "workspace:*",
          fastify: "^5.11.2",
          hono: "^4",
          "@hono/node-server": "^1",
          kysely: "^0.29.5",
          pg: "^8.23.0",
          zod: "^4.5.2",
          ulid: "^3.0.2",
        },
        devDependencies: {
          "@types/node": "^24.0.0",
          "@types/pg": "^8.21.0",
          typescript: "^5.8.0",
          tsx: "^4.20.0",
        },
      },
      null,
      2,
    ) + "\n",
  );

  write(
    path.join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          lib: ["ES2022"],
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          noEmit: true,
          types: ["node"],
        },
        include: ["src", "scripts"],
      },
      null,
      2,
    ) + "\n",
  );

  write(
    path.join(dir, "src", "manifest.ts"),
    `import { defineAppManifest } from "@twodb/core-platform/manifest";

// Declare this app's endpoints here as the feature set gets built — see
// apps/twodb/src/manifest.ts or apps/tworoute/src/manifest.ts for a fully
// worked example (defineEndpoint + Zod request/response schemas). Run
// \`pnpm gen:docs\` after any change to regenerate ENDPOINTS.md/endpoint.json.
export const manifest = defineAppManifest({
  name: "${app.name}",
  slug: "${app.slug}",
  version: "0.1.0",
  shape: "${app.shape}",
  description: "${app.role} — not yet implemented. See AGENTS.md before building it out.",
  capabilities: [],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/${app.slug}",
  endpoints: [],
});

export default manifest;
`,
  );

  write(
    path.join(dir, "src", "messages.ts"),
    `import { defineAppMessages } from "@twodb/core-async/registry";

// Declare this app's queue jobs / broadcast events here as they're added —
// see apps/twodb/src/messages.ts for a worked example. Run \`pnpm gen:docs\`
// after any change to regenerate MESSAGES.md/messages.json.
export const messages = defineAppMessages({ name: "${app.name}", slug: "${app.slug}", jobs: [], events: [] });

export default messages;
`,
  );

  write(
    path.join(dir, "scripts", "gen-docs.ts"),
    `#!/usr/bin/env tsx
import { writeManifestArtifacts } from "@twodb/core-platform/manifest";
import { writeMessagesArtifacts } from "@twodb/core-async/registry";
import manifest from "../src/manifest.js";
import messages from "../src/messages.js";

async function main() {
  await writeManifestArtifacts(manifest, ".");
  await writeMessagesArtifacts(messages, ".");
  console.log("Wrote ENDPOINTS.md / MESSAGES.md / endpoint.json / messages.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
`,
  );

  write(
    path.join(dir, "src", "index.ts"),
    `// Scaffolded stub server — the app is not implemented yet (see AGENTS.md).
// It still runs a real HTTP server so \`pnpm local\` can boot the whole
// ecosystem and TwoDB's pull-registration can fetch a live manifest:
// /healthz always answers, /internal/manifest is served only when the
// orchestrator injected a TWODB_PROVISION_TOKEN (docker-install flow).
// Assign the app's fixed port in apps/twodb/src/orchestrator/catalog.ts
// (6416+) and mirror it as the fallback here.
import { serve } from "@hono/node-server";
import { handleManifestRequest, INTERNAL_MANIFEST_PATH, REGISTRATION_TOKEN_HEADER } from "@twodb/core-platform/manifest";
import { manifest } from "./manifest.js";

const port = Number(process.env.PORT ?? 6416 /* TODO: this app's catalog port */);
const registrationToken = process.env.TWODB_PROVISION_TOKEN;

serve({
  port,
  fetch: (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/healthz") return Response.json({ ok: true, app: manifest.slug, scaffolded: true });
    if (url.pathname === INTERNAL_MANIFEST_PATH && registrationToken) {
      const res = handleManifestRequest(
        { ...manifest, version: "0.1.0" },
        { registrationToken, httpUrl: process.env.HTTP_URL ?? \`http://localhost:\${port}\` },
        req.headers.get(REGISTRATION_TOKEN_HEADER) ?? undefined,
      );
      return Response.json(res.body, { status: res.status });
    }
    return new Response("not found", { status: 404 });
  },
});

console.log(\`\${manifest.name} (scaffolded) listening on :\${port}\`);
`,
  );

  write(
    path.join(dir, "README.md"),
    `# ${app.name}

${app.role}. **Status: scaffolded only** — not yet implemented (see the
ecosystem roadmap, Phase 7+). This folder has the doc-generation pipeline
(\`src/manifest.ts\`, \`src/messages.ts\`, \`scripts/gen-docs.ts\`) wired up and
ready; the actual routes/UI are not written yet.

Shape: \`${app.shape}\`

## Before building this out
1. Read \`AGENTS.md\` in this folder.
2. Look at \`apps/twodb\` (backend+webapp) or \`apps/tworoute\` (backend-only)
   as fully worked examples of the same pipeline.
3. Write real \`defineEndpoint(...)\` entries in \`src/manifest.ts\`, implement
   them in a fastify server under \`src/\`, then run \`pnpm gen:docs\`.
`,
  );

  write(
    path.join(dir, "AGENTS.md"),
    `# AGENTS.md — ${app.name}

${app.role}. **This app is scaffolded, not implemented.** Read \`README.md\`
first.

## Before writing any route
- Add a \`defineEndpoint(...)\` to \`src/manifest.ts\` first (request/response
  Zod schemas + description) — this is the single source of truth
  \`ENDPOINTS.md\`/\`endpoint.json\` are generated from. Write the Fastify
  route to match it, not the other way around.
- This app only ever talks to other apps **through the Gateway**
  (\`apps/twodb\`) — never import \`@twodb/core-platform/transport\` or dial
  another app's URL directly.
- Identity arrives pre-resolved as \`x-twodb-*\` headers forwarded by the
  Gateway (see \`apps/tworoute/src/gateway-context.ts\` for the read-side
  pattern) — never talk to better-auth or the org/workspace/space tables
  yourself.
- One Postgres schema, named \`${app.slug}\`, provisioned by TwoDB
  (\`POST /registry/apps/${app.slug}/provision\`) — access it only via
  \`@twodb/core-data/db\`'s \`createPgDb()\`.
- Call \`registerWithGateway(manifest, opts)\` from
  \`@twodb/core-platform/manifest\` on boot (see \`apps/tworoute/src/index.ts\`).

## Frontend (if this app has a webapp)
Follow \`blocks/CONVENTIONS.md\` exactly: one component per file,
\`partials/\` = dumb UI only, \`hooks/\` = all business logic with one holding
hook per component. Don't add anything to \`blocks/\` speculatively — only
once a second app needs the same component.

## Messaging
If this app needs background jobs or cross-app notifications, declare them
in \`src/messages.ts\` via \`@twodb/core-async/registry\`'s \`defineJob\`/
\`defineBroadcastEvent\` — don't reach for Redis/NATS (v1 is Postgres-backed
only, see the architecture decision log).
`,
  );

  if (isWebapp) {
    const webDir = path.join(dir, "webapp");
    write(
      path.join(webDir, "package.json"),
      JSON.stringify(
        {
          name: `@twodb/app-${app.slug}-webapp`,
          private: true,
          version: "0.0.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "tsc --noEmit && vite build",
            storybook: "storybook dev -p 6600",
            lint: "tsc --noEmit",
          },
          dependencies: {
            "@twodb/blocks": "workspace:*",
            "@twodb/core-runtime": "workspace:*",
            react: "^19.2.8",
            "react-dom": "^19.2.8",
          },
          devDependencies: {
            "@vitejs/plugin-react": "^4.5.0",
            "@tailwindcss/vite": "^4.3.3",
            "@types/react": "^19.2.18",
            "@types/react-dom": "^19.2.4",
            typescript: "^5.8.0",
            vite: "^6.3.0",
          },
        },
        null,
        2,
      ) + "\n",
    );

    write(
      path.join(webDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "Bundler",
            jsx: "react-jsx",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            noEmit: true,
            types: ["vite/client"],
          },
          include: ["src"],
        },
        null,
        2,
      ) + "\n",
    );

    write(
      path.join(webDir, "vite.config.ts"),
      `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({ plugins: [react(), tailwindcss()] });
`,
    );

    write(
      path.join(webDir, "index.html"),
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${app.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    );

    write(
      path.join(webDir, "src", "main.tsx"),
      `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@twodb/blocks/styles.css";

// Starter feature-area skeleton lives at src/feature-x — replace with this
// app's first real pane. Follows the partials/hooks convention from day
// one: see blocks/CONVENTIONS.md.
import { FeatureX } from "./feature-x/FeatureX.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FeatureX />
  </StrictMode>,
);
`,
    );

    write(
      path.join(webDir, "src", "feature-x", "FeatureX.tsx"),
      `import { useFeatureX } from "./hooks/useFeatureX.js";
import { FeatureXEmptyState } from "./partials/FeatureXEmptyState.js";

/**
 * Starter skeleton for ${app.name}'s first real feature/pane. Rename this
 * folder and delete this comment once real work starts here. This
 * component only calls its one holding hook and renders partials — see
 * blocks/CONVENTIONS.md for the full convention.
 */
export function FeatureX() {
  const { isEmpty } = useFeatureX();
  return isEmpty ? <FeatureXEmptyState /> : null;
}
`,
    );

    write(
      path.join(webDir, "src", "feature-x", "hooks", "useFeatureX.ts"),
      `/**
 * Holding hook for <FeatureX /> — compose smaller business hooks here as
 * this feature grows (e.g. useFeatureXData, useFeatureXValidation). Keep
 * all business logic in hooks, never in partials/.
 */
export function useFeatureX() {
  return { isEmpty: true };
}
`,
    );

    write(
      path.join(webDir, "src", "feature-x", "partials", "FeatureXEmptyState.tsx"),
      `/** Dumb/presentational only. */
export function FeatureXEmptyState() {
  return <div>${app.name} — nothing here yet.</div>;
}
`,
    );

    write(
      path.join(webDir, "AGENTS.md"),
      `# AGENTS.md — ${app.name} webapp

Read \`blocks/CONVENTIONS.md\` before adding anything here.

- One component per file.
- \`partials/\` = dumb/presentational only.
- \`hooks/\` = all business logic; one holding hook per component.
- Don't add anything to \`blocks/\` speculatively — only move a component
  there once a **second** app needs it.
- Use \`@twodb/core-runtime/shell\`'s \`<Shell />\` for this app's tabs/panes
  runtime once there's more than one pane type — see apps/twodb/webapp for
  the login/registry pattern this app's auth-gated routes should follow
  (this app talks to the Gateway the same way, just for its own endpoints
  under \`/apps/${app.slug}/*\` instead of TwoDB's control-plane routes).
`,
    );
  }

  console.log(`scaffolded apps/${app.slug}${isWebapp ? " (+webapp)" : ""}`);
}
