# Roadmap Review Checklist

Use this checklist before turning a roadmap idea into code, a GitHub issue, or a Codex-assisted implementation task.

The goal is to keep Open Warehouse System credible for early OSS review: every roadmap item should have a clear workflow, safe fake data, explicit regional assumptions, and a practical verification path.

## Intake Rules

Accept a roadmap item when it has:

- One primary workflow, such as receiving, picking, billing review, tracking lookup, export, or customer self-service.
- One named user role, such as customer, ops staff, warehouse staff, maintainer, or regional contributor.
- One clear risk to review, such as data safety, localization, migration, auth, export format, or integration boundaries.
- One verification path, such as `npm run lint`, `npm run build`, `npm run db:init`, a Playwright smoke test, or a docs-only diff check.

Do not start implementation until the item states:

- Fake demo data only.
- No real customer files, private pricing sheets, labels, payment proofs, logs, or provider dashboards.
- Whether the behavior is China-first, UK-specific, EU-specific, US-specific, or region-neutral.
- Which public document or issue will explain the expected behavior for contributors.

## Priority Lanes

### Safe Demo Seed Data

- Define deterministic fake customers, SKUs, inbounds, outbounds, returns, billing rows, and tracking events.
- Support a dry-run mode before writing any local data.
- Refuse production-like environment names or real provider credentials.
- Document sample output before implementing write behavior.

Recommended verification:

```bash
git diff --check
npm run lint
```

### Playwright Smoke Tests

- Cover one route and one role per test.
- Start with customer, ops, warehouse, and tracking routes that already have stable UI.
- Use fictional personas from `docs/DEMO_PERSONAS.md`.
- Keep screenshots, traces, and test artifacts out of commits unless they are intentionally documented examples.

Recommended verification:

```bash
npm run lint
npm run build
```

### PostgreSQL Hardening

- Identify the local fallback store being replaced.
- Document schema changes, migration behavior, rollback expectations, and seed/demo impact.
- Confirm customer data isolation, audit-log impact, and export localization.
- Keep a local reset path for contributors.

Recommended verification:

```bash
npm run lint
npm run build
npm run db:init
```

### Mobile Warehouse Workflows

- Start with receiving, putaway, picking, packing, handoff, or stock check.
- Define scan states, manual fallback behavior, error handling, and print/export boundaries.
- Keep UI copy concise and usable on small screens.
- Avoid adding carrier or hardware assumptions until the workflow is tested with mock data.

Recommended verification:

```bash
npm run lint
npm run build
```

### Regional Adaptation

- Start from `docs/REGION_PROFILE_TEMPLATE.md`.
- Document language, address, tax, customs, carrier, privacy, currency, and export assumptions before code.
- Prefer configuration and documented templates over hardcoded country logic.
- Keep global-ready claims precise: region-adaptable does not mean universally compliant by default.

Recommended verification:

```bash
git diff --check
npm run lint
```

### Contributor Onboarding

- Convert broad roadmap ideas into small issues with acceptance criteria.
- Link to the exact route, file, or document that needs review.
- Include a verification command in every issue.
- Label safe starter work as `good first issue` only when the blast radius is small.

Recommended verification:

```bash
git diff --check
```

## Issue-Ready Format

Create a GitHub issue when the item can be written in this shape:

```md
Title: docs: review one customer export for localization readiness

Role: regional contributor
Workflow: customer-facing CSV export
Risk: field names, sample values, and region assumptions may be unclear
Scope: review one export only; do not implement new country-specific rules
Acceptance criteria:
- Document current fields and sample fake values.
- Identify which labels are customer-facing and which are internal aliases.
- Add verification notes.
Verification:
- git diff --check
```

## Do Not Start Yet

Pause or rewrite the item if it requires:

- Real carrier, marketplace, tax, customs, payment, or email credentials.
- Real customer data, warehouse addresses, labels, invoices, payment proofs, logs, or private pricing sheets.
- Broad ERP replacement language without a specific warehouse workflow.
- Production compliance claims for a country or region without review evidence.
- A hidden dependency on private documents that contributors cannot inspect.
- A feature that cannot be verified locally by a maintainer or reviewer.

## Related Docs

- `ROADMAP.md`
- `docs/DEMO_DATA_PLAN.md`
- `docs/DEMO_SEED_DATA_GUIDE.md`
- `docs/SMOKE_TEST_PLAN.md`
- `docs/POSTGRES_MIGRATION_REVIEW_CHECKLIST.md`
- `docs/REGIONAL_ADAPTATION_GUIDE.md`
- `docs/REGION_PROFILE_TEMPLATE.md`
- `docs/GOOD_FIRST_ISSUE_DRAFTS.md`
- `docs/FEEDBACK_TO_ISSUE_PLAYBOOK.md`
