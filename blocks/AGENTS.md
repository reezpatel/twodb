# AGENTS.md — @twodb/blocks

Read this before touching anything in `blocks/`.

## What this package is
The shared design system for every Twodb app: UI primitives, tokens, and the
app shell (icon rail, nav sidebar, tabs) that every B+W app's frontend is
built on top of.

## Before you add or change a component
1. Read `CONVENTIONS.md` in this folder — **promotion rule** (don't add
   components here speculatively) and the **partials/hooks file-structure
   rule** (same rule applies here as in every app).
2. Check whether the component already exists under `src/components/ui/*` or
   `src/components/appshell/*`.
3. If you're moving a component **from an app into blocks** because a second
   app now needs it: update both apps' imports, delete the duplicate, and
   note the move in this package's CHANGELOG-ish section of `README.md` if
   one exists.

## Structure
```
src/
├── components/
│   ├── ui/<component>/<component>.tsx    ← primitives
│   └── appshell/<area>/<file>.tsx        ← shell/tabs/nav
├── lib/                                   ← cn() helper etc.
└── styles/                                ← tailwind entry, index.css export
```

## Build / dev
- `pnpm --filter @twodb/blocks storybook` — Storybook dev server
- `pnpm --filter @twodb/blocks build` — typecheck (no bundling; consumers
  import TS source directly via the `exports` map in `package.json`)

## Don't
- Don't put business logic in anything under `components/`.
- Don't import from any `apps/*` package here — dependency direction is
  one-way: apps depend on blocks, never the reverse.
