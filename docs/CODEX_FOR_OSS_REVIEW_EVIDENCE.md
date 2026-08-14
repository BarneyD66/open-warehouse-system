# Codex for OSS Review Evidence

This document collects the public evidence a reviewer can use to evaluate Open Warehouse System quickly.

It is intended for Codex for OSS application review, maintainer handoff, and first-time contributor orientation. It should stay factual and current.

## Repository Identity

- Project: Open Warehouse System
- Public repository: `https://github.com/BarneyD66/open-warehouse-system`
- License: MIT
- Stack: Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, local fallback data
- Positioning: Chinese-first, global-ready open-source WMS starter for cross-border warehouse, fulfillment, inventory, billing, returns, and 3PL operations

The project is an early `0.x` starter. It is not presented as a complete ERP, a production-ready WMS without deployment review, or a universal legal, tax, customs, privacy, labor, or carrier-compliance product.

## Fast Review Path

Start with these files:

- `README.en.md`: positioning, routes, stack, system map, documentation index.
- `docs/OSS_REVIEWER_GUIDE.md`: 10-minute review path, safety signals, and good review questions.
- `docs/OSS_REVIEWER_FAQ.md`: short answers to reviewer questions about scope, maintenance, safety, global readiness, and Codex credit fit.
- `docs/DEMO_WALKTHROUGH.md`: route-by-route local demo path.
- `docs/CODEX_FOR_OSS_APPLICATION_EN.md`: application pitch and current capabilities.
- `docs/CODEX_FOR_OSS_FORM_RESPONSES.md`: copy-ready application form answers and pre-submit checks.
- `docs/CODEX_CREDIT_USE_PLAN.md`: responsible use plan for Codex/API credits.
- `docs/REPOSITORY_HEALTH_CHECK.md`: public-readiness checks for repository state, docs, safety, verification, and remote sync.
- `docs/MAINTENANCE_STATUS_2026_08.md`: recent maintenance snapshot, verification pattern, safety reminder, and next steps.
- `docs/RELEASE_NOTES_DRAFT_V0_1_1.md`: draft release notes for the next documentation and OSS-readiness release.
- `CHANGELOG.md`: public maintenance history.

Suggested local commands:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Core routes:

- `/`
- `/login`
- `/portal`
- `/ops-login`
- `/ops`
- `/warehouse`
- `/tracking`

## Workflow Evidence

The repository documents and exposes these workflow areas:

- Public marketing and inquiry intake.
- Customer registration, login, profile, and self-service portal.
- Inbound ASN, SKU, outbound, returns/RMA, billing, document, and tracking surfaces.
- Ops workbench for lead, customer, inbound/outbound, billing, exception, and todo review.
- Warehouse workbench for receiving, putaway, picking, packing, handoff, location, and print-oriented work.
- Local fallback data for demos and PostgreSQL schema for production-oriented persistence.

Reviewer references:

- `docs/ARCHITECTURE.md`
- `docs/DEMO_PERSONAS.md`
- `docs/DEMO_WALKTHROUGH.md`
- `docs/SMOKE_TEST_PLAN.md`
- `docs/LOCAL_POSTGRESQL.md`
- `docs/DOCKER_COMPOSE_RUNBOOK.md`

## Localization And Release Readiness Evidence

The project documents internationalization as workflow-level review work, not only label translation. Recent maintainer materials make it easier for contributors to review one customer-facing route safely before proposing translations or regional copy.

Reviewer references:

- `docs/INTERNATIONALIZATION.md`
- `docs/GLOBAL_READINESS_REVIEW.md`
- `docs/REGIONAL_ADAPTATION_GUIDE.md`
- `docs/TRANSLATION_CONTRIBUTION_GUIDE.md`
- `docs/LOCALIZATION_WORKFLOW_REVIEW_TEMPLATE.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
- `docs/ISSUE_TRIAGE_LABELS.md`
- `docs/GOOD_FIRST_ISSUE_DRAFTS.md`

The `v0.1.1` draft release notes are intentionally marked as untagged. They summarize documentation, onboarding, demo-safety, CI, dependency, and localization-readiness work without claiming a release has been published.

## Safety And Governance Evidence

The project has explicit public safety rules for:

- Secret handling.
- Real customer data avoidance.
- Public screenshots and demo media.
- Privacy and data retention review.
- PostgreSQL migration review.
- Export localization.
- Staff authentication.
- Pull request review.

Reviewer references:

- `SECURITY.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`
- `docs/PUBLIC_DEMO_CHECKLIST.md`
- `docs/README_MEDIA_PLAN.md`
- `docs/PRIVACY_DATA_RETENTION_GUIDE.md`
- `docs/POSTGRES_MIGRATION_REVIEW_CHECKLIST.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `docs/STAFF_AUTH.md`

Public examples must not include real customer data, production database URLs, `.env.local`, logs, uploads, private pricing sheets, payment proofs, carrier credentials, provider dashboards, or production screenshots.

## Contributor Evidence

The repository includes contributor-facing material for small reviewable work:

- `CONTRIBUTING.md`
- `docs/CONTRIBUTOR_QUICK_PATH.md`
- `docs/CONTRIBUTOR_ONBOARDING.md`
- `docs/GOOD_FIRST_ISSUE_DRAFTS.md`
- `docs/ISSUE_TRIAGE_LABELS.md`
- `.github/ISSUE_TEMPLATE/`
- `.github/pull_request_template.md`

Good first issues are expected to stay narrow, use fake demo data, include acceptance criteria, and run the smallest relevant verification commands.

## Demo Data Evidence

Safe demo data is treated as a public contract, not an afterthought:

- `docs/DEMO_DATA_PLAN.md`
- `docs/DEMO_SEED_DATA_GUIDE.md`
- `docs/DEMO_SEED_DRY_RUN_EXAMPLE.md`
- `docs/LOCAL_DEMO_RESET.md`

The future `npm run seed:demo -- --dry-run` path should refuse production mode, write nothing, print deterministic fake IDs, hide secrets and database URLs, and keep Chinese-mode customer-facing CSV/Excel examples Chinese-first.

## Codex/API Credit Fit

Codex/API credits would be useful for public, reviewable work such as:

- Playwright smoke tests for customer, ops, warehouse, and tracking routes.
- Issue triage and reproducible bug reports.
- Pull request risk review for data isolation, staff auth, billing, inventory, logistics, and migrations.
- PostgreSQL migration review and repository hardening.
- Safe fake demo data and seed scripts.
- English/Chinese documentation alignment.
- Regional adaptation notes and mock carrier adapter design.

Credits should not be used to process private customer records, real labels, production exports, credentials, private pricing, `.env.local`, logs, payment proofs, or confidential documents.

## Review Checklist

Before using this repository as application evidence, confirm:

- The repository is public.
- `README.en.md` renders and links to current docs.
- `CHANGELOG.md` reflects recent public maintenance.
- `docs/REPOSITORY_HEALTH_CHECK.md` has been used for the current application material refresh.
- Demo routes use fake data.
- Screenshot/media examples follow `docs/README_MEDIA_PLAN.md` and `docs/PUBLIC_DEMO_CHECKLIST.md`.
- Current verification commands were run for the latest change.
- Public claims do not overstate production readiness or compliance coverage.

Suggested checks for docs-only evidence updates:

```bash
git diff --check
npm run lint
```

Use `npm run build` when code, package metadata, app behavior, or screenshot-dependent behavior changes.
