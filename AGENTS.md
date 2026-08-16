# AGENTS.md — twodb working agreements

Guidance for anyone (human or agent) working in this repo. Read `plan.md` for
identity, tenancy & access control, `checklist.md` + `tasks/` for its build
breakdown, and `DESIGN.md` for the design system.

## Repository map

- `apps/web` — the main app. A thin **shell**; features ship as plugins.
- `apps/api` — the Fastify host. Feature backends are service plugins.
- `apps/ui-library` — component showcase / design playground.
- `packages/ui` — `@twodb/ui`, the design system (source-consumed).
- `packages/contracts` — `@twodb/contracts`, shared DTOs + event maps (pure types).
- `packages/shared-frontend` / `packages/shared-backend` — plugin kits.
- `plugins/<name>/` — one package per feature: `view/` (React) + `service/` (Fastify).

## Styling conventions

1. **Small styles → inline.** A one-off property or two (spacing tweaks,
   alignment) goes in `style={{ }}` on the element. Don't create a class or a
   style file for trivia.

2. **Large styles → styled-jsx in `<Component>.style.jsx`.** Anything beyond a
   couple of properties lives in a sibling file named after the component,
   exported as a styled-jsx `css` template and applied in the component:

   ```jsx
   // StatusBar.style.jsx
   import css from "styled-jsx/css";

   export const statusBarStyles = css`
     .shell__statusbar { display: flex; /* … */ }
   `;

   // StatusBar.tsx
   import { statusBarStyles } from "./StatusBar.style";

   export function StatusBar() {
     return (
       <footer className="shell__statusbar">
         <style jsx>{statusBarStyles}</style>
         {/* … */}
       </footer>
     );
   }
   ```

   Selectors are scoped to the component automatically. Reference example:
   `apps/web/src/shell/StatusBar.tsx` + `StatusBar.style.jsx`.

   **Scoping caveat:** scoped `css` only reaches elements written in the
   component's own file. When selectors must match elements created
   elsewhere (icons or content imported from data files, shared class hooks
   across regions), export `css.global` instead — see
   `apps/web/src/shell/AppShell.style.jsx` and the other shell regions.
   Reach for scoped `css` first; use `css.global` with a namespaced class
   prefix (e.g. `shell__*`) when you need it.

3. **Always style with design tokens** (`var(--ink)`, `var(--space-3)`,
   `var(--r-md)`, …) — never hardcode colors, spacing, or radii. Tokens come
   from `@twodb/ui` and resolve day/night via `[data-phase]`.

4. **The design-system stylesheet is imported exactly once** — in
   `apps/web/src/main.tsx` (`import "@twodb/ui/styles.css"`). Components and
   plugins import components from `@twodb/ui`, never its stylesheet path.

5. **No Tailwind, no CSS-in-JS libraries other than styled-jsx.** The
   `packages/ui` design system stays plain CSS custom properties (a durable
   decision — see DESIGN.md).

6. The shell regions (`apps/web/src/shell/`) are the reference
   implementation: `StatusBar` uses scoped `css`, the frame and regions use
   `css.global` with the `shell__*` prefix.

## Plugin rules (short version — plan.md is authoritative)

- Every plugin has one dot-namespaced id (`twodb.notes`), boot-validated,
  reused for API prefix (`/api/v1/<id>`), frontend routes (`/<id>`), events,
  functions, and decorators. Plugins never hardcode their own prefixes.
- Cross-plugin communication is event-bus-first; events are facts named
  `<plugin_id>.<noun>.<verb-past>`, typed in `@twodb/contracts`.
- `view/` never imports fastify; `service/` never imports react.

## Commands

- `pnpm dev` in `apps/web` (vite, :5173) / `apps/api` (tsx watch, :3001).
- `pnpm build` in any app — runs `tsc --noEmit` first; keep it green.
- `pnpm db:up` / `db:down` in `apps/api` for postgres + memgraph.

# Important

1. Only add comment when absolutely neccessary
2. Use tanstack-query for interacting with the API
3. Use tanstack-form to manage form state and validation
4. Create a use-<component> hook for business logic
