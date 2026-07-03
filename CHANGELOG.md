# Changelog

All notable public-facing changes to Open Warehouse System are summarized here.

This project is still in the `0.x` phase. Release notes should stay short, workflow-focused, and explicit about setup, security, migration, and contributor-facing changes.

## Unreleased

### Added

- Added `good first issue` issue template for small, well-scoped contributor tasks.
- Added staff authentication documentation covering local demo accounts, `STAFF_WHITELIST_JSON`, and production login rules.
- Expanded `SECURITY.md` with vulnerability reporting, security scope, data handling, and public demo policies.
- Added screenshot and demo media guidance for safe public README assets, release notes, and Codex for OSS application materials.
- Added an open-source maintenance plan covering triage cadence, review policy, quality gates, and release rhythm.
- Added contributor onboarding, safe demo data planning, local PostgreSQL setup notes, and internationalization guidance.
- Added release process guidance with versioning notes, release checklist, and release-note template.
- Added demo seed data guidance for safe fake records, future seed command behavior, and contributor review.
- Added Docker Compose runbook for local PostgreSQL startup, health checks, reset, and troubleshooting.
- Added contributor decision records for architecture, localization, demo data, persistence, and high-risk workflow review.
- Added smoke test plan for customer, ops, warehouse, tracking, PostgreSQL, and documentation-only verification.
- Added export localization checklist for CSV, Excel, templates, sample rows, and printable customer-facing artifacts.
- Added GitHub support guide covering questions, bug reports, feature requests, security reporting, and public data safety.
- Added public Codex/API credit use plan for tests, triage, PR review, docs, demo data, localization, PostgreSQL hardening, and safe carrier adapter design.
- Added region profile template for documenting language, carrier, tax, customs, privacy, export, and workflow assumptions before regional implementation.
- Added maintainer handoff checklist for routine maintenance, release preparation, safety review, and Codex-assisted work.
- Added secret handling checklist for environment files, provider credentials, integration examples, public issues, and Codex/API prompts.
- Added public demo checklist for screenshots, videos, README media, release assets, and Codex for OSS application materials.
- Added deployment environment checklist for auth, data, integration, public-demo, and regional assumption reviews before sharing hosted environments.

### Changed

- README documentation index now links to security, staff authentication, screenshot, onboarding, maintenance, and Codex for OSS materials.
- Demo login documentation now reflects the current customer self-registration flow instead of the old fixed `test / test` prototype login.

### Security

- Public contribution guidance now explicitly rejects real customer data, production screenshots, secrets, logs, `.env.local`, database URLs, carrier credentials, payment proofs, and private pricing sheets.
- Chinese-mode customer-facing exports and templates are documented as Chinese-first, with English field names kept as internal aliases when needed.

## v0.1.0 - 2026-05-31

### Added

- Initial open-source launch package for a Chinese-first WMS starter focused on cross-border warehouse, fulfillment, inventory, billing, returns, and customer self-service workflows.
- Next.js 16, React 19, TypeScript, Tailwind CSS, PostgreSQL schema, local JSON fallback stores, and Playwright-ready project structure.
- Customer, ops, and warehouse surfaces documented in README and architecture notes.
- Codex for OSS application draft, GitHub repository profile copy, launch checklist, initial issue ideas, and star/fork outreach copy.

### Notes

- The launch tag represents an early `0.x` foundation, not a production-ready ERP replacement.
- Public examples and screenshots must use fake demo data only.
