---
name: Commit style
description: Commit in meaningful units, no co-author signature
type: feedback
---

Never add `Co-Authored-By: Claude ...` to commit messages.

Commit in meaningful units — one concern per commit. Do not bundle unrelated changes (e.g. feature code + memory updates + i18n + bug fixes) into a single commit.

Examples of correct splits:
- `feat: add buddy dashboard page` — page.tsx + i18n files only
- `chore: update project memory` — memory files only
- `fix: correct not-registered condition` — bug fix only

**Why:** User has asked for this repeatedly. Bundled commits obscure intent and make history hard to read.
