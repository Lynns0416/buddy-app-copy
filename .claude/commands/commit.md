Commit staged and unstaged changes following project rules:

1. Run `git status` and `git diff` to see all changes
2. Group changes by concern — each group becomes one commit:
   - memory/ changes → separate commit (`chore: update ...`)
   - feature code (API, web pages, types, tests) → one commit per feature
   - i18n files (en.json, ja.json) → commit together with the feature they belong to, not separately
   - config/tooling changes → separate commit
3. For each commit:
   - Stage only the files for that concern
   - Write a concise message: `type: description` (no body needed unless non-obvious)
   - NO `Co-Authored-By` trailer — never
4. Never bundle unrelated concerns into one commit
