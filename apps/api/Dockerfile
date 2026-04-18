FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
COPY prisma/ ./prisma/

RUN pnpm install

COPY packages/types/ ./packages/types/
COPY apps/api/ ./apps/api/
COPY tsconfig.base.json ./

RUN pnpm --filter @peace-buddy/types build

CMD ["sh", "-c", "pnpm --filter @peace-buddy/api exec prisma db push --schema /app/prisma/schema.prisma && pnpm --filter @peace-buddy/api dev"]
