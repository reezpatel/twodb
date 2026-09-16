# syntax=docker/dockerfile:1.7
#
# twodb node agent (twodb-node) — outbound WebSocket client for the controller.
#
# Build from the REPO ROOT (the workspace deps need the monorepo context):
#   docker build -f apps/node/Dockerfile -t twodb-node:local .
#
# Runtime environment:
#   TWO_DB_CONTROLLER_URL      controller base URL (default http://localhost:3001)
#   TWO_DB_CONTROLLER_WS_PATH  WS endpoint path (default /api/v1/io.twodb.node/nodes/ws)
#   TWO_DB_NODE_SECRET         agent auth secret — required; the agent idles without it
#   TWO_DB_HEARTBEAT_MS        heartbeat interval in ms (default 10000, minimum 1000)
#   TWO_DB_ROOT_DIR            jail root for file/command APIs (default: agent cwd)
#
# The agent only makes OUTBOUND WebSocket connections: no ports are exposed and
# it serves no HTTP healthcheck endpoint, so there is no Docker HEALTHCHECK —
# process liveness is covered by the restart policy (restart: unless-stopped).

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Workspace package.json manifest only — shared by the deps/prod-deps stages
# so the lockfile-driven installs stay cacheable.
FROM base AS manifest
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/landing/package.json apps/landing/package.json
COPY apps/node/package.json apps/node/package.json
COPY apps/ui-library/package.json apps/ui-library/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/shared-backend/package.json packages/shared-backend/package.json
COPY packages/shared-frontend/package.json packages/shared-frontend/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY plugins/agent/package.json plugins/agent/package.json
COPY plugins/content/package.json plugins/content/package.json
COPY plugins/identity/package.json plugins/identity/package.json
COPY plugins/node/package.json plugins/node/package.json

FROM manifest AS deps
RUN pnpm install --frozen-lockfile

FROM manifest AS prod-deps
RUN pnpm install --frozen-lockfile --prod

FROM deps AS typecheck
COPY apps/node apps/node
COPY packages packages
COPY plugins plugins
RUN pnpm --filter twodb-node typecheck

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
# Non-root runtime user; all copied files are chowned to 10001 below.
RUN adduser -u 10001 -D -H nodeagent
WORKDIR /app
COPY --from=prod-deps --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=prod-deps --chown=10001:10001 /app/apps/node/node_modules ./apps/node/node_modules
COPY --from=typecheck --chown=10001:10001 /app/apps/node/package.json /app/apps/node/tsconfig.json /app/apps/node/
COPY --from=typecheck --chown=10001:10001 /app/apps/node/src /app/apps/node/src
COPY --from=typecheck --chown=10001:10001 /app/packages/contracts /app/packages/contracts
COPY --from=typecheck --chown=10001:10001 /app/packages/shared-backend /app/packages/shared-backend
COPY --from=typecheck --chown=10001:10001 /app/plugins/content /app/plugins/content
COPY --from=typecheck --chown=10001:10001 /app/plugins/identity /app/plugins/identity
USER 10001
WORKDIR /app/apps/node
# tsx directly instead of `pnpm --filter twodb-node start`: no pnpm/corepack
# needed at runtime (corepack would try to fetch the pinned pnpm on boot).
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
