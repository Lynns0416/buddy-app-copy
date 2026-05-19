---
name: No project_state.md
description: Do not maintain a project_state.md file — it duplicates git history and adds no value
type: feedback
---

Do not create or maintain a `project_state.md` file.

**Why:** Git log is the source of truth for what's been done. A state doc describing completed work just duplicates commit messages. In-flight work details also belong in commits, not a memory file.

**How to apply:** If tempted to write "what's been done" or "current branch status" to memory, don't. Use `plan_*.md` files only for upcoming work before implementation starts, and delete them once the work is committed.
