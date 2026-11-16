# Generic Dockerfile for any backend app in this monorepo. Build with:
#
#   docker build -f deploy/docker/app.Dockerfile --build-arg APP_PKG=@twodb/app-tworoute -t twodb/tworoute:0.1.0 .
#
# (context must be the REPO ROOT, not the app folder — pnpm workspace
# resolution needs the whole tree). TwoDB's orchestrator (src/orchestrator/
# install.ts) always invokes it this way; this comment is for manual/CI use.
#
# Build in the full workspace, then deploy only the selected app and its
# dependency closure into a clean runtime image. This avoids shipping every
# workspace's node_modules in each app image.

FROM node:22-slim AS build

RUN corepack enable && corepack prepare pnpm@11.11.0 --activate

ARG APP_PKG
# Only the console orchestrates sibling app containers via the Docker socket.
# Keep the Docker CLI out of every other app image.
RUN if [ "$APP_PKG" = "@twodb/app-twodb" ]; then \
      apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
      && rm -rf /var/lib/apt/lists/* \
      && ARCH="$(uname -m)" \
      && curl -fsSL "https://download.docker.com/linux/static/stable/${ARCH}/docker-27.5.1.tgz" \
         | tar -xz -C /tmp --strip-components=1 docker/docker \
      && mv /tmp/docker /usr/local/bin/docker \
      && docker --version; \
    else touch /usr/local/bin/docker; \
    fi

WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY core ./core
COPY blocks ./blocks
COPY editor ./editor
COPY apps ./apps
COPY tools ./tools

RUN pnpm install --frozen-lockfile --prod=false

ENV APP_PKG=${APP_PKG}

# Fail fast at build time if APP_PKG was forgotten, instead of a confusing
# runtime error from pnpm.
RUN test -n "$APP_PKG" || (echo "APP_PKG build-arg is required" && exit 1)

# Every app image bundles its React webapp (apps/<slug>/webapp -> dist), served by the app's own
# backend outside /api (see core/twodb-core/src/webapp.ts). The control-plane image additionally
# builds the shared Blocks Storybook, served at the hidden /storybook/ route of the console.
RUN SLUG="${APP_PKG#@twodb/app-}"; \
    if [ -f "apps/$SLUG/webapp/package.json" ]; then pnpm --filter "${APP_PKG}-webapp" build; fi; \
    if [ "$SLUG" = "twodb" ]; then pnpm --filter @twodb/blocks storybook:build; fi

# pnpm deploy creates an isolated production package with just this app's
# runtime dependency graph. Keep dev dependencies: app entrypoints currently
# run TypeScript directly through tsx, which is declared as a devDependency.
RUN pnpm deploy --legacy --filter "$APP_PKG" --prod=true /out
# Keep the monorepo-relative layout expected by app code (console gateway
# assets, metadata, and app webappDist paths). Keep workspace node_modules at
# /out/node_modules so Node resolves it from each nested app directory.
RUN SLUG="${APP_PKG#@twodb/app-}"; \
    mkdir -p "/out/apps/$SLUG"; \
    find /out -mindepth 1 -maxdepth 1 ! -name node_modules ! -name apps -exec mv -t "/out/apps/$SLUG" -- {} +
# Install the small TS runtime loader separately; avoid all app build/test
# toolchains in the final image.
RUN npm install --prefix /tmp/tsx --omit=dev --no-audit --no-fund tsx@4.20.0 \
    && cp -a /tmp/tsx/node_modules/. /out/node_modules/
RUN SLUG="${APP_PKG#@twodb/app-}"; \
    if [ -d "apps/$SLUG/webapp/dist" ]; then mkdir -p "/out/apps/$SLUG/webapp" && cp -a "apps/$SLUG/webapp/dist" "/out/apps/$SLUG/webapp/"; fi; \
    if [ "$SLUG" = "twodb" ]; then mkdir -p /out/blocks && cp -a blocks/storybook-static /out/blocks/; fi

FROM node:22-slim AS runtime
WORKDIR /app
COPY --from=build /out ./
ARG APP_PKG
ENV APP_PKG=${APP_PKG} NODE_ENV=production
# The Docker CLI is needed only by the console app. The build stage provides
# an empty placeholder for other app packages so this conditional copy works.
COPY --from=build /usr/local/bin/docker /tmp/docker-cli
RUN if [ "$APP_PKG" = "@twodb/app-twodb" ]; then mv /tmp/docker-cli /usr/local/bin/docker; else rm /tmp/docker-cli; fi

EXPOSE 3000-9000
CMD ["sh", "-c", "exec node_modules/.bin/tsx apps/${APP_PKG#@twodb/app-}/src/index.ts"]
