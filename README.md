# Local Development Setup

## Prerequisites

- Docker
- Firebase CLI (`npm install -g firebase-tools`) — for Auth emulator

## Repo Structure

```
/
├── apps/
│   ├── web/        ← Next.js (port 3000)
│   └── api/        ← Hono API (port 8080)
├── packages/
│   └── types/      ← shared Zod schemas and TypeScript types
└── prisma/         ← shared Prisma schema and migrations
```

## 1. Environment Variables

Copy the example files and fill in your values:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### `apps/api/.env`

```env
# Firebase
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CLIENT_EMAIL="your-service-account-email"
FIREBASE_PRIVATE_KEY="your-service-account-private-key"

# Use Firebase Auth emulator in local dev
FIREBASE_AUTH_EMULATOR_HOST="host.docker.internal:9099"

# Scheduled jobs — any string in local dev
SCHEDULER_SECRET="local-secret"

# Email (leave blank to skip in dev)
RESEND_API_KEY=""

# Slack (leave blank to skip in dev)
SLACK_WEBHOOK_URL=""

# GCP Storage (leave blank to skip in dev)
GCS_BUCKET_NAME=""
GCS_KEY_FILE=""
```

### `apps/web/.env.local`

```env
# Firebase client config (from Firebase console → Project settings → Your apps)
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-firebase-project-id"

# Use Firebase Auth emulator in local dev
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
```

`DATABASE_URL` and `NEXT_PUBLIC_API_URL` are set automatically by `docker-compose.yml` — do not add them to `.env` files.

## Docker Commands Reference

All commands use the modern `docker-compose` syntax. Run all one-off commands with `--rm` to clean up containers.

| Task | Command |
|------|---------|
| Start dev servers | `docker-compose up --build` |
| Seed database | `docker-compose run --rm api sh -c "cd /app && pnpm exec prisma db seed"` |
| Reset database | `docker-compose down -v && docker compose up --build` |
| Stop all services | `docker-compose down` |

## 2. Firebase Auth Emulator

Run this on your host machine (outside Docker):

```bash
firebase login
firebase emulators:start --only auth
```

The emulator runs at `http://localhost:9099`. Docker containers reach it via `host.docker.internal:9099`.

First time: create `firebase.json` at the repo root:

```json
{
  "emulators": {
    "auth": {
      "port": 9099
    },
    "ui": {
      "enabled": true
    }
  }
}
```

## 3. Start Everything

```bash
docker-compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:8080
- DB: localhost:5432 (peacebuddy / peacebuddy)

Migrations run automatically on API container start.

To seed the database with dummy data for local development:

```bash
docker-compose run --rm api sh -c "cd /app && pnpm exec prisma db seed"
```

To reset the database:

```bash
docker-compose down -v
docker-compose up --build
```

## Running Tests

All test services run with the `test` profile and clean up automatically with `--rm`.

```bash
# API tests
docker-compose --profile test run api-test

# Web tests
docker-compose --profile test run web-test

# Lint check
docker-compose --profile test run lint
```

### API Tests (detailed)

```bash
# specific file
docker-compose --profile test run api-test pnpm test src/middleware/adminAuth.test.ts

# with coverage
docker-compose --profile test run api-test pnpm test:coverage
```

## Scheduled Job Endpoints (Local Testing)

```bash
curl -X POST http://localhost:8080/jobs/notifications/maybe-deadline-reminders \
  -H "X-Scheduler-Secret: local-secret"
```
