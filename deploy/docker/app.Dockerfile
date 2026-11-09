# Generic Dockerfile for any backend app in this monorepo. Build with:
#
#   docker build -f deploy/docker/app.Dockerfile --build-arg APP_PKG=@twodb/app-tworoute -t twodb/tworoute:0.1.0 .
#
# (context must be the REPO ROOT, not the app folder — pnpm workspace
# resolution needs the whole tree). TwoDB's orchestrator (src/orchestrator/
# install.ts) always invokes it this way; this comment is for manual/CI use.
#
# v1 deliberately copies the entire workspace into the image rather than
# doing a trimmed multi-stage `pnpm deploy` build — simpler, correct, and
# fine for a self-hosted single-machine setup. Revisit (prune to just the
# app's dependency closure) if image size/build time become a real problem.

FROM node:22-slim AS base

RUN corepack enable && corepack prepare pnpm@11.11.0 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY core ./core
COPY blocks ./blocks
COPY apps ./apps
COPY tools ./tools

RUN pnpm install --frozen-lockfile --prod=false

ARG APP_PKG
ENV APP_PKG=${APP_PKG}

# Fail fast at build time if APP_PKG was forgotten, instead of a confusing
# runtime error from pnpm.
RUN test -n "$APP_PKG" || (echo "APP_PKG build-arg is required" && exit 1)

EXPOSE 3000-9000

CMD pnpm --filter "$APP_PKG" start
