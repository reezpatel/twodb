# syntax=docker/dockerfile:1.7
# twodb server — serves the built desktop app (static SPA) with the API under
# /api. Requires postgres + memgraph reachable via TWODB_DATABASE_URL /
# MEMGRAPH_URL. The server bootstraps its twodb schema automatically on start.

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/desktop/package.json apps/desktop/
RUN pnpm install --frozen-lockfile --filter @twodb/server --filter @twodb/desktop
COPY apps/server apps/server
COPY apps/desktop apps/desktop
RUN pnpm --filter @twodb/desktop build
RUN pnpm --filter @twodb/server deploy --prod --legacy /out

FROM node:22-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/server/src ./src
COPY --from=build /repo/apps/desktop/dist ./public
COPY <<'EOF' /app/entrypoint.mjs
import { spawn } from "node:child_process";
const tsx = new URL("./node_modules/tsx/dist/cli.mjs", import.meta.url).pathname;
const child = spawn(process.execPath, [tsx, "src/index.ts"], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
EOF
ENV NODE_ENV=production TWODB_STATIC_DIR=/app/public
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:3001/api/health || exit 1
ENTRYPOINT ["node", "/app/entrypoint.mjs"]
