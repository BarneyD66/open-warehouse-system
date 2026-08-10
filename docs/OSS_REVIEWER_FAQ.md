# OSS Reviewer FAQ

This FAQ gives short, factual answers to questions a Codex for OSS reviewer, maintainer, or first-time contributor may ask before evaluating Open Warehouse System.

## Is This Repository Public And Maintained?

Yes. The public repository is `https://github.com/BarneyD66/open-warehouse-system`. The project is maintained as an early `0.x` open-source WMS starter with small, reviewable documentation, safety, onboarding, and workflow updates.

Recent public-maintenance evidence is summarized in `CHANGELOG.md`, `docs/CODEX_FOR_OSS_REVIEW_EVIDENCE.md`, and `docs/REPOSITORY_HEALTH_CHECK.md`.

## What Problem Does It Solve?

Open Warehouse System helps cross-border warehouse, 3PL, and ecommerce fulfillment teams move from spreadsheet and chat-based operations toward structured workflows:

- Customer onboarding and self-service.
- Inbound ASN, SKU, inventory, outbound, return, billing, and tracking flows.
- Ops review and warehouse workbench surfaces.
- PostgreSQL-oriented persistence planning with local fallback data for lightweight demos.

## Why Is It Useful For Open Source?

The project is useful because small warehouse operators often need a readable starter before they can afford or adopt heavier ERP/WMS platforms. The repository exposes practical domain workflows, clear safety rules, contributor onboarding, issue templates, review checklists, and region-adaptation docs that outside contributors can inspect and improve.

## What Does Chinese-first Mean?

Chinese-first means the initial complete customer workflow audience is Chinese-speaking cross-border sellers and warehouse operators. It does not mean the repository is limited to one country or language. Maintainer-facing docs and code should remain English-readable so global contributors can review, deploy, and adapt the project.

## What Does Global-ready Mean?

Global-ready means the project is designed for regional adaptation through documented assumptions, configuration, adapters, and reviewable pull requests. New markets should review language, address formats, carrier services, customs fields, tax labels, billing terminology, privacy rules, and warehouse process assumptions.

Use `docs/GLOBAL_READINESS_REVIEW.md` and `docs/REGIONAL_ADAPTATION_GUIDE.md` before claiming support for a new region.

## What Is Not Claimed?

The project does not claim:

- Complete ERP/WMS parity.
- Production readiness without deployment review.
- Universal legal, tax, customs, privacy, labor, or carrier compliance.
- Real carrier, payment, marketplace, or customs integrations with production credentials.

## How Is Public Data Kept Safe?

Public docs, issues, demos, screenshots, and examples must use fake demo data only. Do not include real customer names, addresses, emails, phone numbers, labels, tracking numbers, payment proofs, private pricing sheets, production screenshots, provider dashboards, `.env.local`, database URLs, secrets, or logs.

Relevant docs:

- `SECURITY.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`
- `docs/PUBLIC_DEMO_CHECKLIST.md`
- `docs/DEMO_DATA_PLAN.md`
- `docs/README_MEDIA_PLAN.md`

## How Would Codex/API Credits Help?

Credits would be used for public, reviewable OSS work:

- Playwright smoke tests for customer, ops, warehouse, and tracking routes.
- Issue triage and reproducible bug reports.
- PR risk review for auth, billing, inventory, logistics, data isolation, and migrations.
- PostgreSQL schema hardening.
- Safe fake demo data and seed scripts.
- English/Chinese documentation alignment.
- Regional adaptation notes and mock carrier adapter design.

Credits should not be used with private customer records, production exports, secrets, logs, payment proofs, or confidential pricing.

## What Should A Reviewer Read First?

Start with:

1. `README.en.md`
2. `docs/OSS_REVIEWER_GUIDE.md`
3. `docs/CODEX_FOR_OSS_REVIEW_EVIDENCE.md`
4. `docs/CODEX_FOR_OSS_FORM_RESPONSES.md`
5. `docs/GLOBAL_READINESS_REVIEW.md`
6. `CHANGELOG.md`

For a quick local check:

```bash
npm install
cp .env.example .env.local
npm run dev
```

For docs-only verification:

```bash
git diff --check
npm run lint
```
