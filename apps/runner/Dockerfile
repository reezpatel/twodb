# twodb runner — connects OUTBOUND to the server over WebSocket and executes
# terminal/exec requests from code sessions. Env: TWODB_SERVER_URL,
# TWODB_RUNNER_KEY (required), TWODB_RUNNER_NAME.
# Teams bridge: Chromium ships in the image (PLAYWRIGHT_BROWSERS_PATH);
# TWODB_TEAMS_PROFILE_ROOT sets where per-account browser profiles live.
FROM node:22-slim

RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/runner/package.json apps/runner/
COPY packages/runner-core/package.json packages/runner-core/
RUN pnpm install --frozen-lockfile --filter @twodb/runner

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium

COPY apps/runner apps/runner
COPY packages/runner-core packages/runner-core
WORKDIR /repo/apps/runner

CMD ["pnpm", "start"]
