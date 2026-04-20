---
name: Always read memory files at session start
description: CLAUDE.md instructs reading memory/project_state.md at every session start. This is not optional.
type: feedback
originSessionId: 69400f3d-1efe-425d-98c8-e3b9a643fc2e
---
Read `memory/project_state.md` at the start of every session before doing anything else, as CLAUDE.md requires.

**Why:** Memory files exist specifically to carry context across sessions. Ignoring them means the user must re-explain everything, wasting their time and money. This happened and caused serious frustration.

**How to apply:** First message of every session — read memory/project_state.md and run the git log commands specified in CLAUDE.md before responding or acting.
