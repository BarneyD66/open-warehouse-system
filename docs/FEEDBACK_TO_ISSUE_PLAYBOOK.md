# Feedback To Issue Playbook

Use this playbook when converting community feedback, friend review notes, demo walkthrough notes, or Codex for OSS reviewer comments into GitHub issues.

The goal is to turn real feedback into small, public, reproducible work without exposing customer data, production details, or vague wishlist items.

## 1. Acceptable Public Feedback

Safe feedback can become a public issue when it is based on:

- README or setup confusion.
- A local demo route that did not behave as expected.
- A workflow question about customer, ops, warehouse, inventory, billing, returns, or tracking surfaces.
- A documentation gap.
- A localization or regional-adaptation assumption that can be discussed without private data.
- A small contributor task with a clear file, route, or doc target.

Do not create a public issue from feedback that includes real customer records, addresses, labels, tracking payloads, invoices, payment proofs, provider dashboards, `.env.local`, logs, database URLs, private pricing sheets, or production incident details.

## 2. Convert Feedback Into An Issue

Use this structure:

```markdown
## Summary

One sentence describing the problem or improvement.

## Context

- Source: friend review / demo walkthrough / maintainer review / Codex for OSS prep
- Route or doc:
- Data mode: local fallback / PostgreSQL / docs-only
- Persona: customer / ops / warehouse / maintainer / regional contributor

## Expected Outcome

What should be clearer, safer, easier to run, or easier to verify?

## Acceptance Criteria

- [ ] Specific result 1
- [ ] Specific result 2
- [ ] Public examples use fake demo data only
- [ ] Verification command or manual route check is listed

## Suggested Labels

`documentation`, `good first issue`, or another relevant label from `docs/ISSUE_TRIAGE_LABELS.md`.
```

## 3. Title Patterns

Prefer specific titles:

- `docs: clarify local demo reset steps`
- `docs: add fake data example for outbound walkthrough`
- `test: add smoke coverage for tracking route`
- `i18n: review Chinese-mode billing export headers`
- `dx: document PostgreSQL startup troubleshooting`

Avoid broad titles:

- `Improve docs`
- `Fix warehouse`
- `Make it global`
- `Add ERP features`

## 4. Good First Issue Bar

Use `good first issue` only when all are true:

- The issue affects one file, one route, one doc, or one narrow workflow.
- A first-time contributor can understand the expected result without private business context.
- Fake demo data is enough.
- The issue does not require production credentials, real carrier payloads, private pricing, or customer files.
- Verification is explicit, such as `git diff --check`, `npm run lint`, or a small manual route check.

If the issue needs design choices, domain tradeoffs, or integration decisions, use `help wanted` instead.

## 5. Safety Review Before Posting

Before publishing an issue, check:

- No real customer, warehouse, carrier, payment, or staff data.
- No screenshots with private tabs, bookmarks, dashboards, chats, or notifications.
- No `.env.local`, database URLs, API keys, secrets, logs, uploads, or production file paths.
- No claim that Open Warehouse System is universally compliant or production-certified.

When in doubt, rewrite the issue using fake IDs from `docs/DEMO_PERSONAS.md`.

## Related Docs

- `docs/COMMUNITY_FEEDBACK_REQUEST_GUIDE.md`
- `docs/ISSUE_TRIAGE_LABELS.md`
- `docs/GOOD_FIRST_ISSUE_DRAFTS.md`
- `docs/DEMO_PERSONAS.md`
- `docs/OSS_REVIEWER_FAQ.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`
