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

Both files are gitignored, so a new `git worktree add` starts without them and
`docker-compose` fails with `env file ... not found`. Copy them from the main
checkout instead of refilling them by hand:

```bash
./scripts/worktree-env.sh
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
| Seed database | `docker-compose exec api npx tsx prisma/seed.ts` |
| Reset database | `docker-compose down -v && docker compose up --build` |
| Stop all services | `docker-compose down` |
| Create a migration | `docker-compose exec api pnpm exec prisma migrate dev --name <change>` |
| Check migration state | `docker-compose exec api pnpm exec prisma migrate status` |

### Schema changes

The api container runs `prisma migrate deploy` on start, so a fresh database is
built from `prisma/migrations/`. Edit `prisma/schema.prisma`, then run
`prisma migrate dev --name <change>` to generate the migration file and commit
it with the schema change.

A database created before migrations existed is not empty and has no migration
history, so `migrate deploy` refuses it with `P3005`. The api container runs
`migrate deploy` before `pnpm dev`, so the symptom is that the API never starts
— check `docker-compose logs api` for `P3005` before looking anywhere else.

Either recreate the database with `docker-compose down -v`, or mark the
migrations as already applied, one `resolve` per directory in
`prisma/migrations/`:

```bash
docker-compose run --rm api pnpm exec prisma migrate resolve --applied 0_init
```

Resolving only `0_init` is right while it is the only directory. Once there are
more, resolve all of them — otherwise `migrate deploy` re-applies the ones the
database already has. `DEPLOYMENT.md` has the full procedure, including the
diff that must pass first.

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
docker-compose exec api npx tsx prisma/seed.ts
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
