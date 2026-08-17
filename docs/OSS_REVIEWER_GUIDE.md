# OSS Reviewer Guide

This guide is for reviewers, maintainers, and first-time contributors who want to understand Open Warehouse System quickly without reading every domain document first.

The project is an early `0.x` warehouse management system starter. It is designed to be practical, inspectable, and safe to extend, not a finished enterprise ERP replacement.

## 10-minute Review Path

Start here:

1. Read `README.en.md` for the project positioning, routes, stack, and documentation index.
2. Read `docs/ARCHITECTURE.md` for the main application surfaces and domain boundaries.
3. Read `docs/CONTRIBUTOR_QUICK_PATH.md` for the expected first-contribution workflow.
4. Read `docs/CONTRIBUTOR_WORKFLOW_MAP.md` to see how routes, roles, APIs, docs, and verification map to small contributions.
5. Read `docs/DEMO_DATA_PLAN.md` and `docs/PUBLIC_DEMO_CHECKLIST.md` to understand the public-data safety model.
6. Use `docs/DEMO_WALKTHROUGH.md` for a route-by-route local review path.
7. Read `docs/CODEX_CREDIT_USE_PLAN.md` to see how Codex/API credits would be used for open-source work.
8. Check `CHANGELOG.md` for recent maintenance and governance improvements.

If you only have time to run the project locally:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000> and review:

- `/login`: customer login and registration.
- `/portal`: customer self-service portal.
- `/ops-login`: staff login entry.
- `/ops`: operations workbench.
- `/warehouse`: warehouse workbench.
- `/tracking`: tracking page.

## What To Evaluate

Review the project on these dimensions:

- Workflow coverage: inbound, SKU, inventory, outbound, returns, billing, documents, tracking, and warehouse operations.
- Maintainability: clear module boundaries, readable TypeScript, reusable stores, and focused docs.
- Data safety: no real customer data, secrets, database URLs, private pricing sheets, production logs, or payment proofs in public materials.
- Access boundaries: customer-facing data should stay isolated; staff-only routes and APIs should require staff validation.
- Localization posture: Chinese-first customer-facing workflows should remain clear, while English docs help global contributors understand and adapt the system.
- Deployment maturity: local fallback data is useful for demos; PostgreSQL is the path for production-oriented persistence.
- Contributor readiness: issue templates, PR checklist, security policy, release notes, and review checklists should make small contributions reviewable.

## What Is Intentionally Not Claimed

Open Warehouse System does not claim:

- Out-of-the-box legal, tax, customs, privacy, labor, or carrier compliance in every country.
- Production readiness without deployment-specific review.
- Real carrier, payment, marketplace, or customs integrations using production credentials.
- A complete replacement for mature ERP/WMS products.

Region-specific deployment work should use `docs/REGION_PROFILE_TEMPLATE.md` and `docs/REGIONAL_ADAPTATION_GUIDE.md`.

## Safety Signals

Strong public-review signals include:

- `SECURITY.md` for vulnerability reporting and public data rules.
- `docs/SECRET_HANDLING_CHECKLIST.md` for credentials, logs, provider examples, and Codex prompt safety.
- `docs/PRIVACY_DATA_RETENTION_GUIDE.md` for customer records, files, billing, carrier data, logs, backups, and exports.
- `docs/POSTGRES_MIGRATION_REVIEW_CHECKLIST.md` for schema, migration, rollback, and data-access review.
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md` for customer-facing CSV, Excel, templates, sample rows, and printable artifacts.

These documents are part of the project's quality bar, not marketing copy.

## Suggested Reviewer Commands

For a documentation or governance review:

```bash
git diff --check
```

For a code review:

```bash
npm run lint
npm run build
```

For PostgreSQL setup or migration-related changes:

```bash
npm run db:init
```

Reviewers should ask contributors to record the commands they ran and the routes they checked.

## Good First Review Questions

- Does the change solve one clear warehouse workflow problem?
- Does it avoid unrelated refactors?
- Does it preserve customer data isolation and staff-only boundaries?
- Does it avoid real customer data, secrets, logs, private screenshots, and production credentials?
- Does it keep Chinese-mode customer-facing exports, templates, and sample data Chinese-first?
- Does it document setup, migration, deployment, or regional assumptions when those assumptions changed?
- Does it include enough verification for the risk level?

## Useful Next Improvements

High-value follow-up work for the open-source roadmap:

- Add safe fake seed data and a one-command demo reset.
- Expand Playwright smoke tests for customer, ops, warehouse, and tracking routes.
- Move more core workflows from local fallback stores to PostgreSQL-backed repositories.
- Add mock carrier adapters with no production credentials.
- Add region profiles for specific deployment markets.
- Improve mobile warehouse scanning and task execution flows.

Keep these improvements small and reviewable. A focused PR with clear verification is better than a large unclear rewrite.
