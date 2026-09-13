# syntax=docker/dockerfile:1

# --- base -------------------------------------------------------------------
FROM node:20-slim AS base
RUN npm install -g pnpm@10
WORKDIR /app

# --- manifests --------------------------------------------------------------
# Every workspace package.json must be present or --frozen-lockfile sees fewer
# importers than the lockfile declares and fails.
FROM base AS manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# --- deps -------------------------------------------------------------------
FROM manifests AS deps
RUN pnpm install --frozen-lockfile

# --- dev (docker-compose target; source arrives via bind mount) -------------
FROM deps AS dev
COPY tsconfig.base.json ./
COPY packages/types/ ./packages/types/
COPY apps/web/ ./apps/web/
RUN pnpm --filter @peace-buddy/types build
# A named node_modules volume is not re-seeded from the image the way an
# anonymous one is, so reconcile it against the lockfile on every start.
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm --filter @peace-buddy/web dev"]

# --- build ------------------------------------------------------------------
# NEXT_PUBLIC_* is inlined into the client bundle at build time, so these are
# build args, not runtime env. NEXT_PUBLIC_API_URL means the api service must
# be deployed (and its URL known) before this image is built.
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/types/ ./packages/types/
COPY apps/web/ ./apps/web/

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
# Off unless this is exactly "true": the Apple provider is not configured in
# Firebase yet, and an enabled button throws on click.
ARG NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED=$NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN pnpm --filter @peace-buddy/types build
RUN pnpm --filter @peace-buddy/web build

# --- runner -----------------------------------------------------------------
# `output: 'standalone'` emits its own pruned node_modules, so no pnpm here.
FROM node:20-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
