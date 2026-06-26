# Contributor Onboarding

This guide gives new contributors a practical first path through Open Warehouse System.

The goal is not to learn every warehouse workflow on day one. The goal is to run the project, understand the major surfaces, choose a small contribution, and avoid touching production-sensitive data.

Before proposing broad architecture, persistence, auth, billing, logistics, or localization changes, read `docs/CONTRIBUTOR_DECISION_RECORDS.md`.

## 30-minute First Run

1. Fork and clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Copy environment defaults:

```bash
cp .env.example .env.local
```

4. Start the app:

```bash
npm run dev
```

5. Open <http://localhost:3000>.

Useful routes:

- `/`: marketing homepage.
- `/login`: customer login and registration.
- `/portal`: customer portal.
- `/ops-login`: staff login.
- `/ops`: ops workbench.
- `/warehouse`: warehouse workbench.
- `/tracking`: tracking page.

## Optional PostgreSQL Path

For database-oriented work, use the local PostgreSQL guide:

- `docker-compose.yml`
- `docs/LOCAL_POSTGRESQL.md`
- `db/schema.sql`
- `scripts/init-postgres.mjs`
- `scripts/migrate-local-json-to-postgres.mjs`

Start with local fallback mode if your contribution is documentation, UI copy, layout, or a narrow frontend workflow.

## Good First Contribution Paths

Choose one bounded path:

- Documentation: improve English setup docs, add screenshots, or clarify a workflow.
- Developer experience: add seed data, local reset instructions, or safer demo setup notes.
- Tests: add a small Playwright smoke test for registration, login, portal entry, or warehouse page load.
- Backend: convert one local fallback store toward a PostgreSQL-backed repository.
- Logistics: design a mock carrier adapter before adding any real carrier credentials.
- Localization: add language examples while keeping Chinese-first customer-visible templates intact.

Good starter issues are listed in `docs/INITIAL_ISSUES.md`.

Project tradeoffs and review constraints are summarized in `docs/CONTRIBUTOR_DECISION_RECORDS.md`.

## Verification Before Pull Request

Run the smallest relevant checks for your change:

```bash
npm run lint
npm run build
```

For documentation-only changes, also run:

```bash
git diff --check
```

If your change touches PostgreSQL setup, run:

```bash
npm run db:init
```

If your change touches customer, ops, or warehouse workflows, include manual verification notes in the pull request.

Use `docs/SMOKE_TEST_PLAN.md` for the recommended customer, ops, warehouse, tracking, PostgreSQL, and documentation-only smoke paths.

## Data and Security Rules

Do not commit:

- `.env.local` or any real environment file.
- Real customer data, warehouse addresses, phone numbers, or emails.
- Production database URLs.
- Payment proofs, invoices, carrier account data, or API credentials.
- Production logs or screenshots containing private operational details.

Use fake customer names, fake SKUs, and fake order references in examples.

## Pull Request Checklist

Before opening a PR, include:

- The business workflow affected.
- The files or routes changed.
- Verification commands and manual checks.
- Any data isolation, authentication, billing, inventory, or logistics risk.
- Screenshots for UI changes where useful.

Keep PRs small. A narrow documentation or workflow improvement is easier to review than a broad refactor.

## Maintainer Review Focus

Maintainers will pay close attention to:

- Customer data isolation by `customer_code`.
- Staff-only access boundaries.
- Inventory and billing correctness.
- Migration safety.
- Chinese-first customer-facing templates and exports.
- Clear operational notes for exceptions, logistics fees, and manual review.

## What To Avoid

- Do not hard-code real carrier credentials or real pricing data.
- Do not silently change billing, inventory, or auth behavior without tests or clear notes.
- Do not replace Chinese customer-facing templates with English-only exports.
- Do not introduce broad abstractions before one real workflow needs them.

## When Unsure

Open an issue or draft PR with:

- The workflow you are trying to improve.
- The expected user.
- The current behavior.
- The proposed behavior.
- The verification plan.

That is enough for maintainers to give useful feedback.
