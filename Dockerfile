# syntax=docker/dockerfile:1.7

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN for p in auth workspace llm node code; do (cd "plugins/$p" && node build.mjs); done
RUN cd apps/web && npx vite build
RUN cd apps/api && node build.mjs
RUN node scripts/vendor-deps.mjs

FROM node:22-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /repo/apps/api/dist/server.mjs ./server.mjs
COPY --from=build /repo/apps/web/dist ./web-dist
COPY --from=build /repo/apps/api/vendor ./vendor
COPY --from=build /repo/plugins/auth/.build ./plugins/auth/.build
COPY --from=build /repo/plugins/workspace/.build ./plugins/workspace/.build
COPY --from=build /repo/plugins/llm/.build ./plugins/llm/.build
COPY --from=build /repo/plugins/node/.build ./plugins/node/.build
COPY --from=build /repo/plugins/code/.build ./plugins/code/.build
COPY <<'EOF' /app/entrypoint.mjs
process.env.TWODB_STATIC_DIR ??= "/app/web-dist";
process.env.TWODB_VENDOR_DIR ??= "/app/vendor";
process.env.TWODB_PLUGINS_DIR ??= "/app/plugins";
await import("./server.mjs");
EOF
ENV NODE_ENV=production
ENV TWODB_WORK_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:3001/health/ready || exit 1
ENTRYPOINT ["node", "/app/entrypoint.mjs"]
