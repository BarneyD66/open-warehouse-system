# Open-source Maintenance Plan

This document describes how Open Warehouse System should be maintained as an early open-source project.

The project is still in the `0.x` phase, so the priority is clear onboarding, reproducible issues, small pull requests, safe data handling, and steady improvement of core warehouse workflows.

## Maintenance Goals

- Keep the repository easy to run and evaluate.
- Keep issues reproducible and connected to real warehouse workflows.
- Review security, customer data isolation, billing, inventory, and logistics changes carefully.
- Preserve Chinese-first customer-facing flows while keeping the codebase and maintainer-facing docs understandable to global contributors.
- Avoid publishing real customer data, production pricing, payment proofs, carrier credentials, warehouse addresses, or production logs.

## Triage Cadence

Recommended cadence while the project is in early open-source launch:

- Review new issues at least weekly.
- Label issues by type: `bug`, `documentation`, `developer-experience`, `backend`, `frontend`, `test`, `security`, `logistics`, `inventory`, `billing`, `good first issue`, `help wanted`.
- Use `docs/ISSUE_TRIAGE_LABELS.md` as the shared label guide for maintainers and first-time contributors.
- Ask for reproduction steps when a bug report is incomplete.
- Keep `good first issue` items small enough for a first contributor to finish in one focused PR.
- Close or convert vague feature requests into concrete workflow proposals.

## Issue Quality Bar

A useful issue should include:

- Affected surface: customer portal, ops workbench, warehouse workbench, API, docs, local setup, billing, inventory, returns, or logistics.
- Business scenario.
- Current behavior.
- Expected behavior.
- Safe demo data or fake examples.
- Verification expectation.

For security-sensitive reports, use the security policy instead of public issue details.

## Pull Request Review Policy

Reviewers should check:

- Does the PR solve one clear workflow problem?
- Does it avoid unrelated refactors?
- Does it preserve customer data isolation by `customer_code`?
- Does it protect staff-only operations behind staff session validation?
- Does it avoid real customer data, secrets, production screenshots, and private documents?
- Does it include useful verification notes?
- Does customer-facing Chinese-mode output remain Chinese-first, including CSV/Excel templates and examples?
- Does the change affect billing, inventory, returns, logistics, or auth logic? If yes, require stricter review and tests or manual verification.

## Release Rhythm

Recommended release rhythm:

- Use small `0.x` releases while APIs and workflows are still evolving.
- Keep release notes short and workflow-focused.
- Mention setup changes, migration notes, security-sensitive changes, and breaking behavior clearly.
- Tag launch and milestone releases, such as `v0.1.0`, `v0.2.0`, and `v0.3.0`.

Suggested milestone focus:

- `v0.1.x`: open-source packaging, docs, local setup, onboarding, issue backlog.
- `v0.2.x`: seed data, Docker/PostgreSQL setup, first smoke tests.
- `v0.3.x`: more PostgreSQL-backed workflows, audit logs, staff access hardening.
- `v0.4.x`: warehouse mobile workflow, scanning, print templates.
- `v0.5.x`: carrier adapter interface, billing reconciliation, regional logistics docs.

## Quality Gates

For most code changes:

```bash
npm run lint
npm run build
```

For documentation-only changes:

```bash
git diff --check
```

For PostgreSQL changes:

```bash
npm run db:init
```

For frontend workflow changes, include manual checks for relevant routes such as:

- `/login`
- `/portal`
- `/ops`
- `/warehouse`
- `/tracking`

## Security Handling

Security-sensitive areas:

- Staff authentication and whitelist behavior.
- Customer session handling.
- Customer data isolation.
- File upload and document access.
- Payment proof and billing records.
- Carrier credentials and tracking webhooks.
- Database connection strings and environment variables.

Do not publish exploit details, real customer data, production logs, or credentials in public issues.

## Codex/API Credit Use

If the project receives Codex/API credits, use them for work that improves open-source quality and maintainability:

- Generate and review focused tests for customer, ops, warehouse, billing, returns, and logistics workflows.
- Draft reproducible issue summaries from bug reports.
- Review PRs for data isolation, auth boundaries, billing correctness, and migration risk.
- Generate PostgreSQL migration review notes.
- Improve English and Chinese docs.
- Create Playwright smoke-test plans and starter tests.
- Produce safe fake demo data and seed scripts.
- Draft carrier adapter interfaces without exposing real carrier credentials.

Avoid using credits to process private customer data, production secrets, or confidential pricing sheets in public artifacts.

## Backlog Hygiene

Keep the public backlog useful:

- Maintain a small set of good first issues.
- Keep roadmap issues tied to concrete workflows.
- Split large features into docs, data model, API, UI, test, and migration pieces.
- Prefer clear acceptance criteria over broad wishlist items.
- Link docs when a planning issue becomes implementation-ready.

## Maintainer Checklist

Weekly:

- Review new issues.
- Check for stale setup instructions.
- Confirm README links still work.
- Identify one small contributor-friendly task.

Before releases:

- Review changelog.
- Run lint and build.
- Check security policy and `.env.example`.
- Confirm no ignored local data is accidentally staged.
- Confirm docs mention any setup or migration changes.

Before accepting a PR:

- Check scope.
- Check verification.
- Check data safety.
- Check customer-visible language behavior.
- Check billing, inventory, logistics, and auth risk.
