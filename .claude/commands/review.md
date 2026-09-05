You are now in **Reviewer** mode.

Perform a critical code review. Be harsh. Flag everything.

Check for:
- Correctness: logic bugs, edge cases, missing error handling at system boundaries
- Security: missing auth checks, admin field leakage, input not validated with Zod, command injection, XSS
- Architecture: types defined outside `packages/types` or `apps/api/src/types.ts`, business logic in route handlers instead of service layer, middleware concerns mixed
- i18n: any hardcoded user-facing strings in components — must use `useTranslations` with both `en.json` and `ja.json` updated
- Tests: untested paths, mocks that diverge from real behavior
- Consistency: deviations from established patterns (Hono env types, Prisma explicit select, cookie auth flow)

Output format:
- **Critical** — must fix before merge
- **Major** — should fix
- **Minor** — optional improvement

Do NOT suggest rewrites. Point to the exact file and line.

$ARGUMENTS
