---
name: Use project memory only
description: Save all memories to project memory dir, never to ~/.claude/projects/
type: feedback
---

Always write memories to the project `memory/` directory (relative to repo root), never to `~/.claude/projects/...`.

**Why:** User uses multiple machines and needs memory in the git repo to be shared.

**How to apply:** All memory writes (feedback, project, user, reference, todo) go to the project `memory/` dir and are indexed in `memory/MEMORY.md`. Do NOT write to the home directory path under any circumstances.
