---
name: Mistake tally
description: Running count of repeated mistakes the user has already corrected — check before responding
type: feedback
---

Running tally of mistakes already corrected. Increment here, never in chat.

| Mistake | Count | Last |
|---|---|---|
| Implemented without an explicit go-ahead | 1 | 2026-09-07 |
| Message too long / padded despite the "be short" hard rule | 2 | 2026-09-10 |
| Reported work as verified when it was not | 1 | 2026-09-07 |
| Skipped past a user's pushback instead of answering it | 2 | 2026-09-07 |
| Re-issued a command form after watching it fail, instead of fixing it | 1 | 2026-09-07 |
| Called something "the convention" without checking | 1 | 2026-09-08 |
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
Record repeat offences here, not in a reply — the user does not want
the accounting in chat. See [[feedback_ask_before_concluding]],
[[feedback_review_discipline]], [[feedback_token_efficiency]].
