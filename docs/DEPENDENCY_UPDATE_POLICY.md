# Dependency Update Policy

This policy explains how maintainers and contributors should update dependencies in Open Warehouse System without increasing review risk or exposing private operational data.

The project is an early `0.x` WMS starter, so dependency work should stay small, reproducible, and explicit about workflow impact.

## Scope

Use this policy for changes to:

- `package.json`
- `package-lock.json`
- `.github/workflows/ci.yml`
- Next.js, React, TypeScript, Tailwind CSS, ESLint, Playwright, and build tooling
- PostgreSQL client or schema initialization tooling
- Docker Compose, Node.js, or CI runtime versions

## Principles

- Keep dependency updates in their own pull request when possible.
- Group routine patch and minor updates only when they share the same risk profile.
- Put major version upgrades in separate pull requests with migration notes.
- Do not combine dependency upgrades with unrelated UI, workflow, schema, or copy changes.
- Do not use production data, customer files, private pricing sheets, payment proofs, carrier labels, logs, or `.env.local` to validate an upgrade.
- Preserve both local fallback mode and PostgreSQL mode unless the PR explicitly changes one of them.
- Explain why the update matters: security fix, compatibility, CI stability, developer experience, or runtime support.

## Risk Levels

### Low Risk

- Documentation-only dependency notes.
- Patch updates for developer tooling.
- Lockfile-only updates for a clearly identified security advisory.
- ESLint or formatter patch updates that do not rewrite unrelated files.

Minimum verification:

```bash
git diff --check
npm run lint
```

### Medium Risk

- TypeScript, ESLint major/minor updates.
- Tailwind CSS or PostCSS updates.
- Playwright updates.
- CI runtime or Node.js version updates.
- Build-tool updates that can change output or route compilation.

Minimum verification:

```bash
npm ci
npm run lint
npm run build
```

Add manual notes for affected contributor workflows or test commands.

### High Risk

- Next.js or React updates.
- PostgreSQL client updates.
- Auth, session, upload, billing, inventory, carrier, or file-processing dependency updates.
- Schema, migration, or repository-layer changes caused by a dependency upgrade.

Minimum verification:

```bash
npm ci
npm run lint
npm run build
npm run db:init
```

Also perform route checks for affected workflows:

- `/login`
- `/portal`
- `/ops-login`
- `/ops`
- `/warehouse`
- `/tracking`

Use fake demo data only.

## Pull Request Notes

Every dependency update PR should include:

- Updated package or runtime.
- Reason for the update.
- Risk level: low, medium, or high.
- Commands run locally.
- Manual routes checked, if behavior changed.
- Data mode checked: docs only, local fallback, PostgreSQL, or both local fallback and PostgreSQL.
- Any known migration, setup, CI, or deployment impact.

Template:

```markdown
## Dependency update

- Package or runtime:
- Reason:
- Risk level:
- Local commands:
- Manual routes:
- Data mode:
- Migration or setup notes:
- Safety notes:
```

## Reject Criteria

Do not merge dependency work that:

- Stages `.env.local`, production credentials, private logs, uploaded files, payment proofs, real carrier labels, or customer records.
- Requires private production services to pass local checks.
- Claims country-specific legal, tax, customs, privacy, labor, or carrier compliance without a regional review.
- Mixes broad unrelated dependency updates with behavior changes.
- Changes auth, billing, inventory, logistics, file access, or database behavior without explicit verification notes.

## Related Docs

- `docs/CI_WORKFLOW_GUIDE.md`
- `docs/SMOKE_TEST_PLAN.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `docs/POSTGRES_MIGRATION_REVIEW_CHECKLIST.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`
- `docs/RELEASE_PROCESS.md`
