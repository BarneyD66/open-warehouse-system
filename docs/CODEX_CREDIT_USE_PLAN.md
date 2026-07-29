# Codex/API Credit Use Plan

This plan explains how Open Warehouse System would use Codex or API credits if the project is accepted for OpenAI Codex for OSS support.

The goal is to improve open-source quality, contributor velocity, and maintainability without processing private warehouse data or production secrets.

## Principles

- Use credits for public, reviewable open-source work.
- Keep tasks tied to concrete WMS workflows: customer portal, ops workbench, warehouse workbench, inventory, billing, returns, logistics, tracking, setup, docs, and tests.
- Prefer small pull requests with explicit verification notes.
- Use fake demo data only.
- Preserve Chinese-first customer-facing workflows, templates, CSV/Excel headers, and sample rows while keeping docs and code understandable to global contributors.
- Do not use credits to process real customer data, private pricing sheets, production logs, carrier credentials, payment proofs, `.env.local`, or confidential documents.

## Priority Uses

### 1. Tests And Smoke Coverage

- Draft Playwright smoke tests for `/login`, `/portal`, `/ops`, `/warehouse`, and `/tracking`.
- Generate focused test ideas for billing, inventory, returns, logistics, staff auth, and customer isolation.
- Review smoke notes against `docs/SMOKE_TEST_PLAN.md`.

### 2. PR Review And Risk Triage

- Review pull requests for data isolation, staff-only auth boundaries, billing correctness, inventory movement risk, logistics side effects, and migration safety.
- Summarize risk areas using `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`.
- Suggest smaller follow-up issues when a pull request mixes unrelated work.

### 3. Issue Triage

- Turn vague bug reports into reproducible steps.
- Map issues to labels from `docs/ISSUE_TRIAGE_LABELS.md`.
- Draft clear acceptance criteria for `good first issue` tasks.

### 4. Documentation And Onboarding

- Improve English setup docs, contributor onboarding, Docker Compose notes, release notes, and support guidance.
- Keep docs aligned with the current app routes and commands.
- Produce concise maintainer notes for public releases.

### 5. Safe Demo Data

- Draft deterministic fake demo datasets for customer, SKU, inbound, inventory, outbound, returns, billing, and notification workflows.
- Review seed data proposals against `docs/DEMO_SEED_DATA_GUIDE.md`.
- Check that screenshots and issue reproductions use visibly fake data.

### 6. Regional Adaptation And Localization

- Draft region-specific adaptation notes for carriers, address formats, tax/customs fields, privacy assumptions, and billing terminology.
- Review CSV, Excel, template, and printable export changes against `docs/EXPORT_LOCALIZATION_CHECKLIST.md`.
- Keep Chinese-mode customer-facing artifacts Chinese-first unless a separate locale is explicitly added.

### 7. PostgreSQL And Architecture Hardening

- Review migration plans and schema changes.
- Generate migration checklists and rollback notes.
- Help convert local fallback workflows to PostgreSQL-backed repositories one boundary at a time.

### 8. Carrier Adapter Design

- Draft safe mock carrier adapter interfaces.
- Review provider-specific integration proposals before any real carrier credentials are introduced.
- Keep credentials, production labels, webhooks, and tracking payloads out of public artifacts.

## Explicit Non-uses

Do not use credits for:

- Processing customer files, real orders, real labels, payment proofs, invoices, private pricing sheets, or production exports.
- Inferring secrets from logs or `.env.local`.
- Generating private customer reports.
- Rewriting large unrelated parts of the codebase without an issue or review plan.
- Producing compliance claims for tax, customs, privacy, labor, or carrier rules without local expert review.

## Review Expectations

Credit-assisted work should still be reviewed like any other contribution:

- Link the relevant issue or document.
- State the workflow being improved.
- Include verification commands.
- Include manual route checks when behavior changed.
- Confirm fake data was used.
- Confirm no secrets, production data, logs, uploads, or private documents were included.

## Success Metrics

The credit use is successful if it produces:

- More reproducible issues.
- More contributor-friendly first tasks.
- Better smoke coverage.
- Clearer setup and release docs.
- Safer demo data.
- More explicit PR risk review.
- Better documented regional adaptation without overstating compliance.

## Related Docs

- `docs/CODEX_FOR_OSS_APPLICATION_EN.md`
- `docs/CODEX_FOR_OSS_REVIEW_EVIDENCE.md`
- `docs/MAINTENANCE_PLAN.md`
- `docs/SMOKE_TEST_PLAN.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `docs/DEMO_SEED_DATA_GUIDE.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
- `SECURITY.md`
