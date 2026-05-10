---
name: Pre-release state — no migration needed
description: App has never been released to prod; schema changes require no migration. DELETE THIS MEMORY once app ships to production.
type: project
originSessionId: b4422d44-5a3d-4967-9db8-c9ddd4f1ed06
---
Pre-release: schema changes need no migration — edit schema.prisma and run `prisma db push`. Never raise migration concerns. Delete this file on first prod deploy.
