# twodb

Turborepo monorepo managed with pnpm workspaces.

## Projects

| Path                | Name               | Description                              | Port |
| ------------------- | ------------------ | ---------------------------------------- | ---- |
| `apps/web`          | `twodb-web-app`    | Main React + Vite web app                | 5173 |
| `apps/ui-library`   | `twodb-ui-library` | Storybook-like showcase for UI components | 5174 |
| `apps/api`          | `twodb-api`        | Fastify (JS) backend                     | 3001 |
| `packages/ui`       | `@twodb/ui`        | Shared React component library           | —    |

## Getting started

```sh
pnpm install
pnpm dev        # runs all apps in parallel via turbo
```

Run a single app:

```sh
pnpm --filter twodb-web-app dev
pnpm --filter twodb-ui-library dev
pnpm --filter twodb-api dev
```

## Using UI components

Both `apps/web` and `apps/ui-library` consume components from `@twodb/ui`:

```tsx
import { Button, Card, Input, Badge } from "@twodb/ui";
```

Add a new component in `packages/ui/src/components/`, export it from
`packages/ui/src/index.ts`, and register a showcase entry in
`apps/ui-library/src/registry.tsx`.




[ TWO_DB_CONTROLLER ] -> Frontend, API
- [ TWO_DB_NODE ] -> Role: StorageProvider - Providers storages, nodes balances themselves
										- Role: ExecutionProvider - Provides a surface to execute code and host code
										- Role: JobProvider - Provides runner to execute jobs.. (serverless env)
