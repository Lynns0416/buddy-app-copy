---
name: Use project memory only
description: Save all memories to project memory dir, never to ~/.claude/projects/
type: feedback
---

Always write memories to the project `memory/` directory (relative to repo root), never to `~/.claude/projects/...`.

**Why:** User wants memories scoped to the project, not the home directory.

**How to apply:** All memory writes (feedback, project, user, reference) go to the project `memory/` dir and are indexed in `memory/MEMORY.md`.
