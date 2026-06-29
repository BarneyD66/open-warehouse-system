# Maintainer Handoff

This document helps a maintainer or trusted collaborator take over routine Open Warehouse System maintenance without losing the project's safety rules or open-source direction.

Use it when someone else is reviewing issues, preparing releases, cleaning up pull requests, or continuing Codex-assisted maintenance.

## Current Project Posture

- Stage: early `0.x` open-source WMS starter.
- Primary audience: cross-border warehouse, fulfillment, 3PL, and ecommerce operations teams.
- Product stance: Chinese-first customer workflows, English-readable repository docs, region-adaptable architecture.
- Safety stance: public artifacts must use fake demo data only.
- Architecture stance: keep the app readable and monolithic while core workflow contracts stabilize.

## First Checks

Before making changes:

```bash
git status --short --branch
git log --oneline -n 10
```

If the worktree contains unrelated changes, do not stage them. Commit only the files required for the current task.

Check for local-only or sensitive files before every commit:

- `.env.local`
- `.local-data`
- logs
- uploads
- production screenshots
- database dumps
- payment proofs
- carrier credentials
- private pricing sheets
- real customer documents

## Routine Maintenance Loop

For each small maintenance pass:

1. Pick one narrow improvement.
2. Prefer docs, tests, setup notes, seed data planning, or issue hygiene unless there is a clear bug.
3. Verify the smallest relevant path.
4. Commit with a clear `docs:`, `test:`, `fix:`, `feat:`, or `chore:` prefix.
5. Push to `origin main` when the change is safe and complete.

Recommended checks:

```bash
git diff --check
npm run lint
```

Run `npm run build` when app behavior, routes, Next.js config, or TypeScript boundaries changed.

## Review Priorities

Prioritize review attention in this order:

- Security reports and customer data isolation.
- Staff-only auth boundaries.
- Billing, inventory, return/RMA, logistics, file download, and carrier workflow risk.
- Setup failures that block contributors.
- Good first issues and contributor onboarding.
- Documentation freshness.
- Regional adaptation and export localization.

Use `docs/PULL_REQUEST_REVIEW_CHECKLIST.md` and `docs/SMOKE_TEST_PLAN.md` for pull request review.

## Documentation Rules

Keep maintainer-facing docs clear in English. Customer-facing Chinese-mode workflows should remain Chinese-first.

When changing customer-visible artifacts:

- Keep Chinese-mode pages, templates, CSV/Excel headers, and sample rows Chinese-first.
- Keep English field names as internal aliases when needed for code, APIs, databases, or integrations.
- Do not expose English-only headers as the only customer-facing export in Chinese mode.
- Use fake demo data in screenshots, examples, and issue reproduction notes.

Use `docs/EXPORT_LOCALIZATION_CHECKLIST.md` for export and template changes.

## Release Handoff

Before tagging a release:

- Review `CHANGELOG.md`.
- Run `npm run lint`.
- Run `npm run build` if code behavior changed.
- Run `git diff --check`.
- Confirm no local data, secrets, logs, production screenshots, or private documents are staged.
- Confirm setup or migration changes are documented.
- Follow `docs/RELEASE_PROCESS.md`.

Use annotated tags for public releases.

## Codex/API Credit Handoff

If Codex/API credits are available, use them only for public open-source maintenance:

- Tests and smoke coverage.
- Issue triage and reproducible bug summaries.
- PR review and risk analysis.
- Documentation and onboarding.
- Safe fake demo data.
- Regional adaptation notes.
- PostgreSQL migration review.
- Mock carrier adapter design.

Do not use credits to process private customer data, production exports, real carrier payloads, payment proofs, logs, secrets, or `.env.local`.

See `docs/CODEX_CREDIT_USE_PLAN.md`.

## Escalation

Pause and ask for maintainer review before merging changes that:

- Modify auth, session, password, staff whitelist, or customer isolation behavior.
- Touch billing calculations, inventory movement, stocktake, returns, carrier labels, tracking webhooks, or file downloads.
- Add a real external provider integration.
- Add region-specific tax, customs, privacy, or carrier claims.
- Require production credentials or private customer examples.
- Change database schema or migration behavior.

## Related Docs

- `MAINTAINERS.md`
- `docs/MAINTENANCE_PLAN.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `docs/SMOKE_TEST_PLAN.md`
- `docs/RELEASE_PROCESS.md`
- `docs/CODEX_CREDIT_USE_PLAN.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
- `SECURITY.md`
