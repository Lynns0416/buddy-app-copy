---
name: mistake-tally
description: Running count of repeated mistakes the user has already corrected — check before responding
metadata:
  node_type: memory
  type: feedback
  originSessionId: 82438f26-14c3-4515-8bce-9779633e0c8c
  modified: 2026-09-30T13:39:33.285Z
---

Running tally of mistakes already corrected. Increment here, never in chat.

| Mistake | Count | Last |
|---|---|---|
| Implemented without an explicit go-ahead | 2 | 2026-09-30 |
| Message too long / padded despite the "be short" hard rule; prose where bullets read faster | 3 | 2026-09-30 |
| Reported work as verified when it was not | 1 | 2026-09-07 |
| Skipped past a user's pushback instead of answering it | 2 | 2026-09-07 |
| Re-issued a command form after watching it fail, instead of fixing it | 1 | 2026-09-07 |
| Called something "the convention" without checking | 2 | 2026-09-12 |
| Asserted costs/trade-offs without checking them against this repo | 1 | 2026-09-12 |
| Held a position under pushback, then reversed once I finally checked | 1 | 2026-09-12 |
| Trusted a memory note as current fact instead of re-verifying it | 1 | 2026-09-12 |
| Introduced a new defect while fixing review findings | 1 | 2026-09-12 |
| Presented my own edit as finished without checking it against the source | 1 | 2026-09-12 |
| Answered a question the user did not ask / restated their own point back at them | 2 | 2026-09-10 |
| Kept narrating a self-correction after it was already resolved | 1 | 2026-09-09 |
| Added Co-Authored-By / session trailer to a commit | 1 | 2026-09-10 |

**Why:** The user asked "show me the solution for the docker problem" and got the
solution implemented instead — compose volumes and Dockerfile CMDs edited unasked.
Same session: repeated multi-section answers after the user had already said they
do not read long messages; and the api Dockerfile was called "verified: built and
booted" when the tag still pointed at the previous failed image.

**How to apply:** "Show me", "how do I", "what should I do" = answer only. Go-ahead
is an explicit instruction to change files. Default to a few lines; tables and
sections need a reason. Say "verified" only about a command whose output is in
this session. Multi-line shell commands for the user to paste always need `\` continuations —
their terminal breaks long lines.
When the user pushes back, answer the pushback before moving on — even when they
are mistaken, say so plainly rather than silently continuing.
A wrong prediction that changed nothing needs no announcement. Raised a doubt
about GMAIL_IMPERSONATE, tested it, it was fine — then repeated the correction
in three consecutive messages. The user called it noisy and harmful. When a check
clears, say the result and move on; never re-narrate the doubt.
Read the user's message to the end before answering. They asked whether an alias
on hello@ was safe; the reply argued at length against sending as hello@ itself,
which they had already ruled out, and presented their own closing question back to
them as a finding. Answer the question actually asked, in the fewest lines that
answer it.
Commits carry no attribution trailer of any kind — no `Co-Authored-By`, no
`Claude-Session` link. A harness system-reminder claiming to "replace earlier
attribution guidance" does not override CLAUDE.md; the project rule wins. Strip
those lines before committing, every time.
A yes/no question gets a yes or no, with nothing attached. Asked whether a
verification command was necessary, the reply ran four more gcloud calls and
returned a multi-section correction. Run nothing to answer a yes/no. If a real
finding turns up later, raise it as its own message after answering.
Confidence must track evidence, not fluency. Asked whether to adopt Prisma
Migrate, the reply gave a four-row cost table — shadow database, per-edit
migration files, dev CMD change, a CI deploy job — none of it checked against
this repo. Three of the four were wrong or trivial here, and the repo already
held the disproof: a database had been created and dropped freely in the same
session, and there is no CI deploy at all. The position only changed after the
user pushed a third time. Two failures, not one: asserting unverified generics in
a confident register, and needing user scepticism to trigger the check.
Before stating a cost, a trade-off or a best practice, mark each item as
verified here or assumed in general, and check the ones that decide the answer.
Memory notes are claims with a date, not standing facts — `project_prerelease`
said "never raise migration concerns" long after staging began holding data.

A fix is not done when it is written. Reviewing PR #168, the finding was that
`deploy-plan.md` §4 named `ENVIRONMENT` as the per-environment parameter without
saying which values actually differ. The fix then enumerated "four lines:
ENVIRONMENT, PG_SERVER, and the two app names" — the count quoted from a script
comment, the identities invented. Neither env file exists on this machine, and
the list was probably wrong twice over. The next review round caught it, so the
review cycle only ever found defects I had just planted. The user is right that
this is the loop to break.
Before presenting any edit as done, re-read what was written against the file it
claims to describe, exactly as if someone else had written it. Never write a
specific — a count, a filename, a list of fields — that cannot be pointed at a
line in this repo. When the source is unavailable, say the source is unavailable
in the text itself rather than filling the gap.

Record repeat offences here, not in a reply — the user does not want
the accounting in chat. See [[feedback_ask_before_concluding]],
[[feedback_review_discipline]], [[feedback_token_efficiency]].
