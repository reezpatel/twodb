# Component working agreements

These rules apply to everything under `apps/desktop/src/components/` and to code that consumes these components.

## Change approval

- Do not add, remove, move, or edit files under `src/components/` without explicit user approval.
- A request that specifically names a component change counts as approval only for the scope of that request. Ask before making additional component changes.

## Component boundaries

- `ui/` contains reusable UI primitives. Add shadcn components through its CLI rather than hand-rolling replacements.
- `blocks/` contains styled, reusable product-level compositions built from `ui/` primitives.
- Visual rendering and all styling belong in `blocks/` or `ui/`. This includes layout, spacing, padding, classes, inline styles, and component-specific CSS.
- Route, scene, feature, and other application-layer components may own business logic, data loading, state, event handling, and decisions about what to render. They must compose `blocks/` and `ui/` without defining styling of their own.
- Existing code has not yet been fully migrated to this boundary. Apply it to all new work and move touched visual code into `blocks/` or `ui/` as future changes are made; do not perform an unrelated broad rewrite.

## Storybook

- Storybook is exclusively for components in `blocks/` and `ui/`.
- Keep `*.stories.*` files beside their component under one of those two directories.
- Never add stories under routes, scenes, features, or any other directory.
- Stories should exercise visual states through component props and fixtures; do not move application business logic into stories.


## Notes
1. Dont add business logic in components, always take in param
