---
name: Always use Docker for commands
description: Never run shell commands directly — all commands must run inside Docker
type: feedback
---

Never run commands (npm, npx, pnpm, prisma, etc.) directly in the shell.

**Why:** The project runs in a Docker environment. Running commands outside Docker has caused repeated mistakes and user frustration.

**How to apply:** Always use `docker compose exec` or `docker compose run` to run any command. Check docker-compose.yml for service names first if unsure.
