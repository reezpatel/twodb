# @twodb/blocks

The `blocks` UI library — a from-scratch design system implementing the **Isometric
Lab** theme (see `THEME.MD`), built and documented in its own Storybook, independent
of `apps/desktop`.

**Status: not yet consumed anywhere.** `apps/desktop` keeps using its existing
`src/components/ui` + `src/components/blocks` components until this library is ready
to replace them.

## Develop

```sh
pnpm --filter @twodb/blocks storybook
# or
pnpm local:blocks
```

Storybook runs on http://0.0.0.0:6699.

## Layout

```
packages/blocks/
  .storybook/           # Storybook config (Vite + Tailwind v4 + a11y/themes addons)
  THEME.MD               # Isometric Lab theme spec — source of truth for tokens/components
  src/
    components/
      ui/                # elementary/primitive components (Button, Chip, Card, Dialog, Form/*)
                          # one folder per component, co-located with its *.stories.tsx
    lib/utils.ts          # cn() helper (clsx + tailwind-merge)
    styles/index.css      # Isometric Lab design tokens / Tailwind v4 theme
    index.ts               # public exports
```

## Notes

- Theme tokens live in `src/styles/index.css`, derived from `THEME.MD`. Light is the
  primary theme; dark is a faithful night version.
- Stack: React 19, Tailwind v4, CVA, Radix primitives, Lucide icons.
- Elementary components live under `src/components/ui`; composed/compound components
  will live under `src/components/blocks` as the library grows.
