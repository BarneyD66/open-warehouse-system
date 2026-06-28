# Open Warehouse System

[中文说明](README.md) | English README

Open Warehouse System is a global-ready, Chinese-first open-source WMS starter for cross-border warehouse, fulfillment, inventory, billing, returns, and 3PL operations.

It is designed for warehouse operators, ecommerce sellers, overseas warehouse teams, and 3PL service providers who need a practical foundation for customer self-service, inbound ASN, SKU management, inventory, outbound fulfillment, returns/RMA, billing review, logistics tracking, and warehouse operations.

> Global-ready means the system is designed to be adaptable across markets. Country-specific tax, customs, carrier, privacy, and labor rules should be configured or extended for each deployment.

![Open Warehouse System preview](public/assets/uk-warehouse-brand-hero.png)

## Why This Project Exists

Many small and mid-sized fulfillment teams do not need a heavy ERP on day one. They need a system foundation that can replace spreadsheets, chat-based operations, and manual reconciliation with structured workflows.

Open Warehouse System packages common warehouse and cross-border fulfillment workflows into a readable Next.js + PostgreSQL reference implementation that can be deployed, audited, and extended by teams in different regions.

## Who Can Use It

- Cross-border ecommerce sellers managing overseas inventory.
- Overseas warehouse and 3PL teams serving multiple customers.
- Small fulfillment teams moving from spreadsheets to structured operations.
- Developers learning WMS, OMS, inventory movement, billing, returns, and warehouse workflow design.
- SaaS builders who need an operations-workbench starter for logistics-heavy products.

## Core Capabilities

- Marketing and lead intake: service pages, inquiry forms, pricing explanation, help center.
- Customer portal: registration, login, profile, inquiries, inbound ASN, SKU, outbound, returns, billing, files.
- Ops workbench: lead follow-up, quote drafts, customer review, inbound/outbound progress, billing review, exceptions, todos.
- Warehouse workbench: receiving, putaway, picking, packing, handoff, locations, print pages.
- Inventory foundation: SKU records, balances, movement logs, adjustment approval, stocktake and replenishment planning.
- Logistics and billing: carrier rules, rate estimates, labels/tracking, statement confirmation, payment proof, dispute handling.
- Data layer: local JSON fallback plus PostgreSQL schema for production migration.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- PostgreSQL via `postgres`
- Playwright verification
- Vercel-friendly deployment

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

Common routes:

- `/` marketing homepage
- `/login` customer login and registration
- `/portal` customer portal
- `/ops-login` staff login
- `/ops` ops workbench
- `/warehouse` warehouse workbench
- `/tracking` tracking page

For production deployments, configure `SESSION_SECRET`, `STAFF_WHITELIST_JSON`, `POSTGRES_URL` or `DATABASE_URL`, and disable demo login switches.

## Database

The project can run with local `.local-data` fallback stores for demos, or PostgreSQL for production-oriented storage.

```bash
npm run db:init
npm run db:migrate:local
```

The schema lives in `db/schema.sql`.

## Internationalization Positioning

The project starts from Chinese-first workflows because many real cross-border warehouse operators and sellers work in Chinese. The architecture and documentation are intentionally open and English-readable so global contributors can adapt the system for their own language, carrier, tax, customs, and compliance needs.

This is a starter, not a claim of out-of-the-box legal or logistics compliance in every country.

## Documentation

- `docs/CODEX_FOR_OSS_APPLICATION.md`: Chinese/primary Codex for OSS application draft.
- `docs/CODEX_FOR_OSS_APPLICATION_EN.md`: English Codex for OSS application draft.
- `docs/CODEX_CREDIT_USE_PLAN.md`: public plan for responsible Codex/API credit use.
- `docs/ARCHITECTURE.md`: application surfaces, domain modules, persistence and security boundaries.
- `docs/CONTRIBUTOR_QUICK_PATH.md`: short first-contribution path for new contributors.
- `docs/CONTRIBUTOR_ONBOARDING.md`: first-run, first-contribution, and PR guidance for contributors.
- `docs/CONTRIBUTOR_DECISION_RECORDS.md`: lightweight project decisions for contributors and maintainers.
- `docs/DEMO_DATA_PLAN.md`: safe fake demo data plan for onboarding, screenshots, and tests.
- `docs/DEMO_SEED_DATA_GUIDE.md`: safe demo seed data contract and future seed command expectations.
- `docs/DOCKER_COMPOSE_RUNBOOK.md`: Docker Compose PostgreSQL startup, reset, healthcheck, and troubleshooting notes.
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`: CSV, Excel, template, and printable export localization checklist.
- `docs/INTERNATIONALIZATION.md`: localization, regional adaptation, and global-readiness notes.
- `docs/LOCAL_DEMO_RESET.md`: safe local fallback data reset guidance.
- `docs/LOCAL_POSTGRESQL.md`: local PostgreSQL and Docker Compose setup.
- `docs/MAINTENANCE_PLAN.md`: issue triage, release rhythm, review policy, and quality gates.
- `docs/MOCK_CARRIER_ADAPTER.md`: safe mock carrier adapter design for logistics contributors.
- `docs/OPEN_SOURCE_LAUNCH_CHECKLIST.md`: launch checklist and repository setup notes.
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`: PR review checklist for scope, verification, data safety, and localization.
- `docs/REGIONAL_ADAPTATION_GUIDE.md`: practical checklist for adapting language, carriers, tax, customs, privacy, and billing by region.
- `docs/RELEASE_PROCESS.md`: release checklist, versioning notes, and release-note template.
- `docs/SCREENSHOT_GUIDE.md`: safe screenshot and demo media guidance.
- `docs/SMOKE_TEST_PLAN.md`: minimal smoke verification plan for contributors and maintainers.
- `docs/STAFF_AUTH.md`: staff whitelist, demo login, and production authentication guidance.
- `SECURITY.md`: vulnerability reporting, security scope, and public data policy.
- `SUPPORT.md`: support channels, issue expectations, and public data safety rules.
- `CHANGELOG.md`: public release history and release-note summary.
- `docs/INITIAL_ISSUES.md`: first public issues for contributors.
- `docs/GOOD_FIRST_ISSUE_DRAFTS.md`: copy-ready good first issue drafts.
- `docs/ISSUE_TRIAGE_LABELS.md`: GitHub issue label guide for maintainers and contributors.
- `docs/STAR_AND_FORK_MESSAGE.md`: copy for asking friends to star or fork.
- `ROADMAP.md`: project roadmap.

## Good Contribution Areas

- Seed data and one-command local setup.
- Docker Compose for local PostgreSQL.
- Playwright smoke tests for customer, ops, and warehouse workflows.
- PostgreSQL-backed repositories for more core workflows.
- Mobile warehouse scanning and task actions.
- Carrier adapter interface and mock carrier implementation.
- English documentation and localization examples.
- Region-specific deployment guides.

## License

MIT License. Please do not commit real customer data, production database URLs, warehouse addresses, payment proofs, or secrets.
