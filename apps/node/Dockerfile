FROM node:22-slim AS build

WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/node/package.json apps/node/
RUN pnpm install --frozen-lockfile --filter twodb-node

COPY packages/contracts packages/contracts
COPY apps/node apps/node
RUN cd apps/node && node build.mjs

FROM node:22-slim

WORKDIR /agent
COPY --from=build /repo/apps/node/dist/agent.mjs ./

CMD ["node", "agent.mjs"]
