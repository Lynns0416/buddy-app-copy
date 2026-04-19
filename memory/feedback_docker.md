---
name: Always use Docker for commands
description: Never run shell commands directly — all commands must run inside Docker
type: feedback
---

Never run commands (npm, npx, pnpm, prisma, etc.) directly in the shell. No exceptions.

**Why:** The project runs in a Docker environment. This rule has been violated multiple times across sessions despite being written in CLAUDE.md and this memory. The user is explicitly frustrated by repeated violations.

**How to apply:** Before running any shell command, ask: is this going via `docker-compose exec <service>`? If not, stop. Check docker-compose.yml for service names. `npm test`, `npx vitest`, `tsc` etc. must all go through Docker.
