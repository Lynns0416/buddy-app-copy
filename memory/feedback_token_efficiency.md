---
name: Token efficiency — read/check discipline
description: Rules for minimizing token use during coding tasks
type: feedback
---

Keep token use minimal. 11k tokens for small targeted changes is unacceptable.

**Why:** The user flagged this explicitly after a session with only a few files and few lines changed.

**How to apply:**

- **grep first, read only what you'll edit.** Use `grep -n` to find exact lines, then `Read` with `offset`/`limit` to just that section. Never read a full file when a section suffices.
- **No exploratory reads.** If grep output is enough to write the edit, do not Read the file. Only Read a file if you need to see surrounding code to write a correct edit.
- **Skip typecheck for mechanical changes.** i18n key additions, simple boolean guards (`&& !flag`), additive-only changes do not need a typecheck run. Only typecheck when type signatures, new error codes, or non-trivial logic changes are involved.
- **Consolidate grep queries.** One broad grep beats four narrow ones.
- **Abort Docker iteration fast.** One failure → diagnose the right invocation immediately, don't retry variations.
- **No reads for files you won't edit.** Don't read api-client.ts, admin pages, etc. just to understand context if you're not editing them.
- **User handles task management manually.** Do not use TaskCreate/TaskUpdate.
