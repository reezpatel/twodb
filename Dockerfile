# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# better-sqlite3 compiles from source on musl (no prebuilt binaries).
# Only build stages inherit this; the runtime stage copies node_modules.
RUN apk add --no-cache python3 make g++
RUN corepack enable
WORKDIR /app

# Full-context installs: plugin packages (plugins/*) declare their own deps
# (e.g. @fastify/multipart), so every workspace manifest must be present at
# install time and every package's node_modules must reach the runtime.
# The pnpm store cache mount keeps repeated installs fast despite COPY . .
# invalidating the layer on any source change.
FROM base AS deps
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS prod-deps
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
	pnpm install --frozen-lockfile --prod

FROM deps AS build
RUN pnpm --filter twodb-api typecheck
RUN pnpm --filter twodb-web-app build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001
ENV STATIC_DIR=../../../apps/web/dist
# Api-owned sqlite db lives here; mount a volume to persist it:
#   docker run -v twodb-data:/data ...
ENV TWO_DB_WORK_DIR=/data
WORKDIR /app
# prod-deps already contains the full workspace sources + prod node_modules
# for every package (root, apps, packages, plugins).
COPY --from=prod-deps /app ./
COPY --from=build /app/apps/web/dist ./apps/web/dist
EXPOSE 3001
WORKDIR /app/apps/api
# The api's start script (tsx src/index.ts), invoked directly: running via
# `pnpm --filter twodb-api start` would reconcile the partial workspace
# (auto-install) on every boot — tsx needs neither pnpm nor network.
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
