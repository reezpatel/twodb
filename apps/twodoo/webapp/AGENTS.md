# AGENTS.md — TwoDoo webapp

Read `blocks/CONVENTIONS.md` before adding anything here.

- One component per file.
- `partials/` = dumb/presentational only.
- `hooks/` = all business logic; one holding hook per component.
- Don't add anything to `blocks/` speculatively — only move a component
  there once a **second** app needs it.
- Use `@twodb/core-runtime/shell`'s `<Shell />` for this app's tabs/panes
  runtime once there's more than one pane type — see apps/twodb/webapp for
  the login/registry pattern this app's auth-gated routes should follow
  (this app talks to the Gateway the same way, just for its own endpoints
  under `/apps/twodoo/*` instead of TwoDB's control-plane routes).
