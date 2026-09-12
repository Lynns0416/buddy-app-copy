# syntax=docker/dockerfile:1

# --- runtime base -----------------------------------------------------------
# openssl is required by the Prisma query engine on debian.
FROM node:20-slim AS runtime-base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- build base -------------------------------------------------------------
FROM runtime-base AS base
RUN npm install -g pnpm@10

# --- manifests --------------------------------------------------------------
# Every workspace package.json must be present or --frozen-lockfile sees fewer
# importers than the lockfile declares and fails.
FROM base AS manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY prisma/ ./prisma/

# --- deps (incl. dev — needed to compile) -----------------------------------
FROM manifests AS deps
RUN pnpm install --frozen-lockfile

# --- dev (docker-compose target; source arrives via bind mount) -------------
FROM deps AS dev
COPY tsconfig.base.json ./
COPY packages/types/ ./packages/types/
COPY apps/api/ ./apps/api/
RUN pnpm --filter @peace-buddy/types build
RUN pnpm exec prisma generate --schema /app/prisma/schema.prisma
# A named node_modules volume is not re-seeded from the image the way an
# anonymous one is, so reconcile it against the lockfile on every start.
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm --filter @peace-buddy/types build && pnpm exec prisma generate --schema /app/prisma/schema.prisma && pnpm exec prisma migrate deploy --schema /app/prisma/schema.prisma && pnpm --filter @peace-buddy/api dev"]

# --- build ------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/types/ ./packages/types/
COPY apps/api/ ./apps/api/
RUN pnpm exec prisma generate --schema /app/prisma/schema.prisma
RUN pnpm --filter @peace-buddy/types build
RUN pnpm --filter @peace-buddy/api build

# node-linker=hoisted flattens the whole workspace into a single node_modules,
# so `pnpm install --prod --filter` prunes nothing — apps/web's tree comes along
# and the image lands at 1.2 GB. `pnpm deploy` copies an isolated tree instead.
RUN pnpm deploy --legacy --frozen-lockfile --filter @peace-buddy/api --prod /out
# The prisma CLI is a dev dependency and so is absent from the deployed tree;
# carry over the client generated above.
RUN cp -r /app/node_modules/.prisma /out/node_modules/.prisma

# --- runner -----------------------------------------------------------------
FROM runtime-base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist

USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
