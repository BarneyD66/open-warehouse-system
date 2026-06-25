# Contributor Decision Records

This document records the lightweight technical and product decisions that new contributors should understand before proposing broad changes.

The goal is not to freeze the architecture. The goal is to make project tradeoffs explicit so pull requests stay reviewable, safe, and aligned with real warehouse workflows.

## How To Use This Document

- Read it before proposing a new persistence layer, auth model, carrier integration, billing workflow, or localization strategy.
- Link a relevant decision in issues and pull requests when it explains the review constraint.
- Add a new short decision when a pull request creates a reusable pattern or changes an existing project boundary.
- Keep decision notes practical: context, decision, consequences, and related docs.

## Decision 001: Keep The App Monolithic While Workflows Stabilize

### Context

Open Warehouse System is an early `0.x` WMS starter. The main risk is not service scale; the main risk is unclear warehouse workflow behavior across customer, ops, warehouse, billing, returns, and logistics surfaces.

### Decision

Keep the application as a readable Next.js App Router monolith until the core workflow contracts are stable.

### Consequences

- Contributors should prefer focused modules and explicit domain helpers over splitting services early.
- Cross-cutting concerns such as auth, data isolation, audit logs, and billing should stay easy to inspect in one repository.
- Future service extraction should be justified by a clear operational boundary, not by default architecture preference.

### Related Docs

- `docs/ARCHITECTURE.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`

## Decision 002: Keep Chinese-first Customer-facing Workflows

### Context

Many real cross-border warehouse operators and sellers use Chinese for daily operations, templates, status text, and customer-facing exports. At the same time, the repository should remain understandable to global contributors.

### Decision

Keep customer-facing Chinese-mode pages, admin copy shown to customers, downloadable templates, CSV/Excel headers, and sample rows Chinese-first. Use English-readable internal names, docs, and aliases where they help contributors or integrations.

### Consequences

- Do not replace Chinese customer-facing templates with English-only exports.
- Internal English aliases are acceptable when they do not leak into the customer-facing artifact.
- Internationalization work should preserve the Chinese-first baseline while making regional adaptation easier.

### Related Docs

- `docs/INTERNATIONALIZATION.md`
- `docs/REGIONAL_ADAPTATION_GUIDE.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`

## Decision 003: Prefer Fake Demo Data Over Sanitized Production Data

### Context

Warehouse systems often contain private customer names, addresses, tracking events, payment proofs, invoices, carrier accounts, pricing sheets, and operational exceptions. Sanitized production data is easy to get wrong.

### Decision

Use fully fake, deterministic demo data for screenshots, onboarding, seed plans, tests, issues, and public release notes.

### Consequences

- Contributors should not attach production screenshots, logs, uploads, labels, payment proofs, or private spreadsheets.
- Demo records should use visibly synthetic IDs, contacts, addresses, tracking numbers, and document names.
- Seed commands must refuse production mode and must never read from private files.

### Related Docs

- `docs/DEMO_DATA_PLAN.md`
- `docs/DEMO_SEED_DATA_GUIDE.md`
- `docs/SCREENSHOT_GUIDE.md`
- `SECURITY.md`

## Decision 004: Support Local Fallback And PostgreSQL During Migration

### Context

Local fallback files make onboarding fast. PostgreSQL is needed for production-oriented persistence, migrations, and realistic workflow testing.

### Decision

Support both local fallback storage and PostgreSQL while core workflows are progressively moved toward PostgreSQL-backed repositories.

### Consequences

- Documentation and tests should state which mode they use.
- Data migration work should be incremental and tied to one workflow boundary at a time.
- Local fallback reset and Docker PostgreSQL reset must stay clearly separated.
- Contributors should not assume local fallback behavior is a production data model.

### Related Docs

- `docs/LOCAL_DEMO_RESET.md`
- `docs/LOCAL_POSTGRESQL.md`
- `docs/DOCKER_COMPOSE_RUNBOOK.md`

## Decision 005: Treat Auth, Billing, Inventory, Logistics, And File Access As High-risk Areas

### Context

Small mistakes in warehouse software can expose customer data, corrupt inventory, create incorrect billing, or leak private documents.

### Decision

Require stricter review and clearer verification notes for changes that touch auth, customer isolation, billing, inventory, logistics, returns, warehouse execution, file downloads, or carrier integration.

### Consequences

- Pull requests in these areas should include manual checks, tests, or rollback notes when practical.
- Staff-only APIs must remain protected by staff session validation.
- Customer-facing reads and writes must remain scoped to the relevant customer identity boundary.
- Public issues should avoid exploit details and private operational evidence.

### Related Docs

- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `docs/ISSUE_TRIAGE_LABELS.md`
- `SECURITY.md`
