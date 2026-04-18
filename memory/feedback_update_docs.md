---
name: Always update docs during discussion
description: User expects docs to be updated in real time as decisions are made, not just held in memory
type: feedback
---

Always update the relevant docs files (PRD.md, data-model.md, architecture.md, etc.) immediately when a decision is made during discussion. Do not hold decisions only in conversation memory. Other team members read these docs too, not just Claude.

When writing any UI code: ALL user-facing strings must use i18n from the start. Never write hardcoded strings in components — always use `useTranslations` (next-intl) and add the keys to both en.json and ja.json at the same time. This is in the PRD (§12) and is non-negotiable.
