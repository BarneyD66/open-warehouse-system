# Public Collaboration Review Loop

Use this loop after an issue is ready to publish and before a contributor pull request is merged.

The goal is to make public collaboration visible, reviewable, and safe during the Open Warehouse System `0.x` phase and Codex for OSS review period.

## 1. Start From A Safe Issue

Before inviting contributors into a task, confirm the issue has already passed:

- `docs/PUBLIC_ISSUE_QUEUE.md`
- `docs/ISSUE_PUBLISHING_CHECKLIST.md`
- `docs/FIRST_ISSUE_RESPONSE_TEMPLATE.md`

Each issue should name one workflow, one user role, one route or document boundary, one expected outcome, one verification path, and one non-goal.

## 2. Confirm Contributor Scope

Before a contributor starts a pull request, ask them to confirm:

- The change uses fake demo data only.
- The change does not include `.env.local`, credentials, production logs, private pricing, payment proofs, labels, invoices, or customer screenshots.
- The change fits one route, API boundary, document, test, or workflow note.
- The contributor understands the relevant non-goal.
- The verification command is clear enough to run locally.

If scope expands into billing logic, authentication, production integrations, carrier credentials, database migrations, or regional compliance claims, ask for a smaller first PR.

## 3. Convert Issue Work Into A Pull Request

Every public PR should include:

- A summary of the issue it closes or advances.
- The workflow and role being changed.
- The files or routes touched.
- The acceptance criteria copied or linked from the issue.
- Verification notes.
- Screenshots only when they use fake demo data and pass `docs/PUBLIC_DEMO_CHECKLIST.md`.

For a docs-only issue, a small PR is enough. For code changes, ask the contributor to include the route, API boundary, or test path they verified.

## 4. Review With The Smallest Relevant Gate

Use the smallest verification gate that matches the change:

| Change type | Review gate |
| --- | --- |
| Documentation only | `git diff --check` |
| UI copy or route rendering | `npm run lint`, `npm run build` |
| API, auth, billing, inventory, logistics, or warehouse code | `npm run lint`, `npm run build`, workflow smoke notes |
| PostgreSQL schema or repository work | `npm run lint`, `npm run build`, `npm run db:init` |
| Public screenshots or media | `git diff --check`, `docs/PUBLIC_DEMO_CHECKLIST.md` |
| Regional adaptation | `git diff --check`, `npm run lint`, `docs/REGION_PROFILE_TEMPLATE.md` |

Also check:

- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `docs/SMOKE_TEST_PLAN.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md` when customer-facing exports or templates change

## 5. Merge, Close, Or Narrow

Merge when:

- The issue scope is satisfied.
- Verification notes are present.
- Public data safety is clear.
- The change does not make broad production-readiness or universal compliance claims.

Close or narrow when:

- The issue needs private customer context.
- The PR includes secrets, production logs, customer files, screenshots, or real operational identifiers.
- The PR attempts a broad ERP rewrite instead of one workflow increment.
- The regional claim needs a profile, legal review, carrier review, or tax/customs validation first.

## Maintainer Reply Snippets

Ready for PR:

```md
Thanks. The scope looks safe and reviewable. Please keep the PR limited to the workflow and verification path listed in the issue, and use fake demo data only.
```

Needs scope reduction:

```md
This is useful, but the proposed scope is too broad for one public PR. Please narrow it to one route, document, API boundary, or test path and keep the current non-goals explicit.
```

Verification requested:

```md
Please add the verification command you ran and any workflow smoke notes needed for maintainers to review this without private context.
```

Unsafe public data:

```md
Please remove the real customer, credential, log, screenshot, pricing, label, invoice, or payment data from the PR before review can continue.
```

## Review Outcome Log

For each contributor PR, maintainers should leave one closing note:

```md
Review outcome:
- Scope:
- Verification:
- Data safety:
- Follow-up issue, if any:
```

This keeps repository activity useful for contributors and gives reviewers a clear public trail of how Open Warehouse System handles collaboration safely.
