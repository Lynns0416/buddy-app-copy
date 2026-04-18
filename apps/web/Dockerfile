FROM node:20-slim

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/

RUN pnpm install

COPY packages/types/ ./packages/types/
COPY apps/web/ ./apps/web/
COPY tsconfig.base.json ./

RUN pnpm --filter @peace-buddy/types build

CMD ["pnpm", "--filter", "@peace-buddy/web", "dev"]
