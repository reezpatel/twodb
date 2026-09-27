# twodb runner — connects OUTBOUND to the server over WebSocket and executes
# terminal/exec requests from code sessions. Env: TWODB_SERVER_URL,
# TWODB_RUNNER_KEY (required), TWODB_RUNNER_NAME.
FROM node:22-slim

RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/runner/package.json apps/runner/
RUN pnpm install --frozen-lockfile --filter @twodb/runner

COPY apps/runner apps/runner
WORKDIR /repo/apps/runner

CMD ["pnpm", "start"]
