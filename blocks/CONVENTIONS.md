# Blocks Conventions

`blocks` (`@twodb/blocks`) is the shared design system for every Twodb app. It
holds UI that is *actually reused across 2+ apps*, or is obviously generic
from day one (buttons, inputs, dialogs, layout primitives, the app shell).

## Promotion rule
- **Never start a component here.** Build it in the owning app first
  (`apps/<app>/src/...`).
- The moment a **second** app needs the same component — or it's clearly a
  generic primitive (e.g. `<Button>`, `<DataTable>`, form controls, modals) —
  move it into `blocks` and have both apps import it from there.
- Blocks does not pre-guess reusability. It earns components through actual
  reuse. This is a continuous rule applied throughout the ecosystem's life,
  not a one-time pass.

## File-per-component + partials/hooks split
Applies identically here and in every app's frontend:

- **Each component lives in its own file.**
- **`partials/`** — dumb/presentational components only. Pure props-in/JSX-out.
  No data fetching, no business logic, no direct store/API access.
- **`hooks/`** — all business logic.
  - **Business hooks**: one hook per meaningful unit of logic
    (e.g. `useSortableRows`, `useDialogFocusTrap`).
  - **Holding hook**: one hook per component that composes the business hooks
    together; the component calls only this hook and renders partials with
    the result.

```
feature-x/
├── FeatureX.tsx
├── hooks/
│   ├── useFeatureX.ts          ← holding hook, backs FeatureX.tsx
│   ├── useFeatureXData.ts      ← business hook
│   └── useFeatureXValidation.ts
└── partials/
    ├── FeatureXHeader.tsx
    ├── FeatureXRow.tsx
    └── FeatureXEmptyState.tsx
```

If you're tempted to put `useState`/`useEffect`/a fetch call inside something
under `partials/`, it belongs in a hook instead.

## Storybook
- `blocks` has its own Storybook (`pnpm --filter @twodb/blocks storybook`)
  covering every exported primitive and the app shell.
- Every app with a webapp also runs its **own** Storybook for app-specific
  components, importing `blocks`' tokens/components rather than redefining
  them.

## What already lives here (carried forward from the old monolith)
- `components/ui/*` — button, card, chip, dialog, form controls, tabs
- `components/appshell/*` — shell, icon rail, nav sidebar, tabs, status bar —
  this is the base the ecosystem's tabs/pane runtime (`core-runtime/shell`)
  builds on top of.
- `components/ai-code/*` — carried as-is for now; apps that don't need it
  simply don't import it. Revisit whether it should move to `apps/artisan`
  once Artisan is built (it's app-specific, not a generic primitive).
