# CI Workflow Guide

This guide explains the current GitHub Actions workflow for Open Warehouse System and how contributors should interpret it.

The workflow lives at `.github/workflows/ci.yml`.

## Current Workflow

CI runs on:

- Pull requests.
- Pushes to `main`.
- Pushes to `master`.

The current job uses:

- Ubuntu latest.
- Node.js 20.
- `npm ci` for dependency installation.
- `npm run lint`.
- `npm run build`.

This means CI checks basic code quality and production build readiness for the public repository.

## What CI Proves

A passing CI run means:

- Dependencies install from `package-lock.json`.
- ESLint completes successfully.
- The Next.js production build completes successfully.
- The change does not require private customer data or production credentials to build.

## What CI Does Not Prove

CI does not replace:

- Manual route checks for customer, ops, warehouse, tracking, billing, or returns workflows.
- PostgreSQL initialization checks with `npm run db:init`.
- Local fallback data reset checks.
- Screenshot or public demo safety review.
- Customer data isolation review.
- Staff-only access review.
- Legal, tax, customs, privacy, labor, or carrier compliance review.

Use `docs/SMOKE_TEST_PLAN.md` for manual workflow checks.

## Local Reproduction

Before opening or reviewing a pull request, contributors can reproduce the CI path locally:

```bash
npm ci
npm run lint
npm run build
```

For documentation-only changes, the minimum local check is:

```bash
git diff --check
```

For PostgreSQL, schema, migration, repository, or persistence changes, also run:

```bash
npm run db:init
```

## Safe Data Rules

CI and CI logs must not include:

- `.env.local`
- Production database URLs.
- Real customer records.
- Private warehouse addresses.
- Payment proofs or invoices.
- Carrier credentials, labels, tokens, or webhook secrets.
- Private pricing sheets.
- Uploads, logs, or local fallback data files.

Use fake demo data and synthetic IDs only.

## PR Verification Notes

Pull requests should include:

- CI status.
- Local commands run.
- Manual routes checked, if behavior changed.
- Data mode: docs only, local fallback, or PostgreSQL.
- Fake data used.
- Any auth, data isolation, billing, inventory, logistics, file, or migration risk.

Template:

```markdown
## CI and verification

- CI:
- Local commands:
- Manual routes:
- Data mode:
- Fake data:
- Risk notes:
```

## Troubleshooting

If `npm ci` fails:

- Confirm `package-lock.json` is committed and matches `package.json`.
- Do not switch package managers in the same PR unless that is the explicit scope.

If `npm run lint` fails:

- Fix the reported file and rule.
- Keep unrelated formatting churn out of the PR.

If `npm run build` fails:

- Check route imports, server/client component boundaries, environment assumptions, and TypeScript errors.
- Do not add production secrets to make a build pass.

If PostgreSQL-related work passes CI but fails locally:

- Run `docker compose up -d postgres`.
- Run `npm run db:init`.
- Check `docs/POSTGRES_MIGRATION_REVIEW_CHECKLIST.md`.

## Related Docs

- `docs/SMOKE_TEST_PLAN.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `docs/CONTRIBUTOR_QUICK_PATH.md`
- `docs/CONTRIBUTOR_ONBOARDING.md`
- `docs/POSTGRES_MIGRATION_REVIEW_CHECKLIST.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`
