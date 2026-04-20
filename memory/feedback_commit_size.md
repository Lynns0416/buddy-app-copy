---
name: Don't squash unrelated concerns into one large commit
description: User prefers smaller, focused commits — even when squashing, don't bundle everything into one
type: feedback
originSessionId: 15cb5b34-49d0-4bcf-8fa8-72361456b7cf
---
Don't squash multiple concerns into a single large commit even when cleaning up history.

**Why:** User explicitly rejected a squash of refactor + test setup + page changes into one commit as "too big."

**How to apply:** When rewriting or reorganising commits, keep the same concern-grouping rules as for new commits: tooling/config, lib extraction, tests, and page changes should each be their own commit.
