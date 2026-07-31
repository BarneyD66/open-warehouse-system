# Release Notes Draft: v0.1.1

Status: draft, not yet tagged.

This draft helps maintainers prepare the next small `0.x` documentation and open-source readiness release for Open Warehouse System. Review `CHANGELOG.md` and `docs/RELEASE_PROCESS.md` before creating a tag or GitHub release.

## Suggested Summary

`v0.1.1` is a documentation, onboarding, and maintainer-readiness update for the early Open Warehouse System public launch. It improves reviewer orientation, safe demo guidance, CI reproduction, release process, dependency update rules, and contributor entry points without changing runtime warehouse behavior.

## Highlights

- Added a clearer OSS reviewer path for evaluating the system, safety posture, and current `0.x` scope.
- Added CI workflow guidance for reproducing GitHub Actions locally with `npm ci`, `npm run lint`, and `npm run build`.
- Added dependency update policy with risk levels, required checks, and public data safety rules.
- Added README media and screenshot planning guidance so public assets use fake demo data only.
- Added demo walkthrough and demo seed dry-run notes for safer onboarding and future seed work.
- Added maintainer-facing checklists for releases, handoff, privacy, deployment review, PostgreSQL migration review, and secret handling.

## Security And Data Safety

- This release should remain documentation-only unless maintainers intentionally add code changes before tagging.
- Release notes, screenshots, examples, and demo data must not include real customer records, warehouse addresses, carrier labels, carrier credentials, payment proofs, production URLs, `.env.local`, production logs, private pricing sheets, or uploaded customer files.
- The project remains an early `0.x` starter and does not claim universal legal, tax, customs, carrier, privacy, or labor compliance.

## Verification Before Tagging

For a documentation-only `v0.1.1` tag:

```bash
git diff --check
npm run lint
```

If maintainers add code, route, database, Next.js configuration, or dependency changes before tagging, also run:

```bash
npm run build
```

For PostgreSQL, schema, migration, repository, or persistence changes, also run:

```bash
npm run db:init
```

## Migration Or Setup Notes

- No migration is expected for a documentation-only `v0.1.1` release.
- No new environment variables are expected.
- Existing production deployment guidance still requires safe `SESSION_SECRET`, `STAFF_WHITELIST_JSON`, and PostgreSQL configuration when leaving local demo mode.

## Copy-ready GitHub Release Body

```markdown
## Summary

`v0.1.1` improves open-source reviewer readiness, contributor onboarding, demo safety, CI reproduction, release process, and dependency update guidance for Open Warehouse System.

## Added

- OSS reviewer guide and Codex for OSS review evidence index.
- CI workflow guide and dependency update policy.
- README media plan, screenshot guidance, demo walkthrough, and demo seed dry-run notes.
- Maintainer handoff, release, privacy, deployment, PostgreSQL migration, and secret-handling checklists.

## Security And Data Safety

- Public materials use fake demo data only.
- Do not include customer records, warehouse addresses, carrier credentials, payment proofs, production URLs, `.env.local`, logs, private pricing sheets, or uploaded customer files.
- This remains an early `0.x` WMS starter, not a universal compliance product.

## Verification

- `git diff --check`
- `npm run lint`

## Migration Or Setup Notes

- Documentation-only release.
- No database migration or new environment variables expected.
```

## Final Checks

Before publishing:

- Move the relevant `CHANGELOG.md` entries from `Unreleased` into `v0.1.1 - YYYY-MM-DD`.
- Confirm the commit range does not include unrelated local product work.
- Confirm no private data, logs, screenshots, `.env.local`, or production documents are staged.
- Create an annotated tag only after verification passes.
