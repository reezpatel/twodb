# @twodb/core-runtime

Two independent concerns — **always import the subpath you need**
(`@twodb/core-runtime/cli` or `@twodb/core-runtime/shell`), not the root
barrel, so frontend bundles never pull in Node-only CLI code.

## `cli` — twodb-cli
Reads any registered app's `endpoint.json` (served by TwoDB's gateway
registry at `/registry/apps/:slug/endpoint.json`) and turns it into a live
CLI with one subcommand per endpoint — path params become required flags,
extra query params via `--query k=v`, JSON bodies via `--data` or
`--data-stdin`. Streaming endpoints pipe raw chunks to stdout.

```
twodb apps
twodb tworoute completions --data '{"model":"gpt-4o","messages":[...]}'
```

Auth: `--api-key`/`TWODB_API_KEY` for workspace API keys; `--workspace`/
`--space` are only meaningful for session auth (not needed with API keys).

## `shell` — tabs/panes runtime
`<Shell definitions={[...]} store={...} />` — the tabs/panes runtime every
B+W app's frontend sits on top of.

- `definitions`: one `PaneDefinition` per pane type the app supports
  (e.g. `mail.thread`, `mail.folder`), each with a `title()` deriver and the
  React component to render.
- `store`: a `PaneStateStore` — either `createLocalStoragePaneStore(key)` or
  `createApiPaneStore({load, save})` for apps that persist pane state in
  their own DB instead (per decision log, this varies per app).

Internally this follows the same partials/hooks convention as every app:
`useShell` is the holding hook (composes `usePaneRegistry` +
`usePaneState`), `Shell.tsx` only calls it and renders the dumb
`ShellTabsBar`/`ShellPaneHost` partials.
