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
- Added privacy and data-retention guide for customer records, files, billing, carrier data, logs, backups, exports, and regional review.
- Added PostgreSQL migration review checklist for schema, migration scripts, data access, rollback, export localization, and deployment safety.
- Added OSS reviewer guide with a fast review path, safety signals, verification commands, and current `0.x` project scope.
- Added a good first issue draft for planning a safe demo seed dry-run workflow before implementation.
- Added a demo seed dry-run output example for future safe seed command review.
- Added a compact Mermaid system map to the English README and updated the related architecture good first issue draft.
- Added a safe demo walkthrough for route-by-route local review, screenshots, and Codex for OSS application preparation.
- Added README media plan covering screenshot slots, filenames, alt text, captions, and public safety checks.
- Added Codex for OSS review evidence index for application review, workflow evidence, safety posture, contributor readiness, and credit-use fit.
- Added CI workflow guide for GitHub Actions checks, local reproduction, PR verification notes, and safe CI data rules.
- Added dependency update policy covering risk levels, verification commands, PR notes, and public data safety rules.
- Added draft `v0.1.1` release notes for the next documentation and OSS-readiness release.
- Added translation contribution guide for workflow-level localization, Chinese-first customer artifacts, regional assumptions, and public data safety.
- Added locale-readiness good first issue draft for reviewing one customer workflow at a time.
- Clarified `localization` and `internationalization` issue label usage for workflow-level translation and broader regional adaptation work.
- Added localization workflow review template for mapping one customer-facing route before translation work.
- Added repository health check guide for OSS review readiness, public-data safety, verification, and remote sync.
- Added pre-submit review checklist to the English Codex for OSS application draft.
- Added copy-ready Codex for OSS form responses with safety and pre-submit checks.
- Added global readiness review checklist for regional adaptation claims, boundaries, and contribution review.
- Added OSS reviewer FAQ covering scope, maintenance, public data safety, global readiness, and Codex/API credit fit.
- Added community feedback request guide for healthy stars, forks, issues, early reviews, and public data safety.
- Added August 2026 maintenance status snapshot covering recent docs, verification pattern, safety rules, and next steps.
- Added safe fictional demo personas for customer, ops, warehouse, maintainer, and regional contributor review.
- Added `v0.1.1` release candidate checklist for scope, required docs, verification, data safety, tagging, and follow-up.
- Added feedback-to-issue playbook for converting community review notes into safe, reproducible GitHub issues.
- Added roadmap review checklist for turning broad roadmap ideas into safe, scoped, verifiable issues or implementation tasks.
- Added contributor workflow map linking roles, routes, API boundaries, docs, contribution shapes, and verification commands.
- Added public issue queue with ready-to-publish safe backlog items for maintainers and first-time contributors.

### Changed

- README documentation index now links to security, staff authentication, screenshot, onboarding, maintenance, and Codex for OSS materials.
- Demo login documentation now reflects the current customer self-registration flow instead of the old fixed `test / test` prototype login.
- Draft `v0.1.1` release notes now include recent translation, localization, Codex for OSS application, global-readiness, repository health check, and reviewer FAQ materials.
- Codex for OSS review evidence now highlights localization and release-readiness materials for reviewers.
- Star/fork outreach copy now uses readable Chinese and English text and points readers toward useful feedback, not empty activity.

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
