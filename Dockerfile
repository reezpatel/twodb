# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/ui-library/package.json apps/ui-library/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/notes/package.json packages/notes/package.json
COPY packages/shared-backend/package.json packages/shared-backend/package.json
COPY packages/shared-frontend/package.json packages/shared-frontend/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter twodb-api typecheck
RUN pnpm --filter twodb-web-app build

FROM deps AS prod-deps
RUN CI=true pnpm prune --prod

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001
ENV STATIC_DIR=../../../apps/web/dist
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY package.json pnpm-workspace.yaml ./
EXPOSE 3001
CMD ["pnpm", "--filter", "twodb-api", "start"]
