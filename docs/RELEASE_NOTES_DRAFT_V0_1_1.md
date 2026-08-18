# Release Notes Draft: v0.1.1

Status: draft, not yet tagged.

This draft helps maintainers prepare the next small `0.x` documentation and open-source readiness release for Open Warehouse System. Review `CHANGELOG.md`, `docs/RELEASE_PROCESS.md`, and `docs/RELEASE_CANDIDATE_CHECKLIST_V0_1_1.md` before creating a tag or GitHub release.

## Suggested Summary

`v0.1.1` is a documentation, onboarding, localization, application-readiness, and maintainer-readiness update for the early Open Warehouse System public launch. It improves reviewer orientation, safe demo guidance, CI reproduction, release process, dependency update rules, workflow-level localization review, Codex for OSS application materials, roadmap scoping, public issue preparation, and contributor entry points without changing runtime warehouse behavior.

## Highlights

- Added a clearer OSS reviewer path for evaluating the system, safety posture, and current `0.x` scope.
- Added CI workflow guidance for reproducing GitHub Actions locally with `npm ci`, `npm run lint`, and `npm run build`.
- Added dependency update policy with risk levels, required checks, and public data safety rules.
- Added README media and screenshot planning guidance so public assets use fake demo data only.
- Added demo walkthrough and demo seed dry-run notes for safer onboarding and future seed work.
- Added maintainer-facing checklists for releases, handoff, privacy, deployment review, PostgreSQL migration review, and secret handling.
- Added translation, localization, and region-adaptation guidance for workflow-level customer-facing review.
- Added a localization workflow review template and good first issue path so contributors can map one route safely.
- Added Codex for OSS form responses, pre-submit checks, repository health check guidance, global-readiness review, and reviewer FAQ materials.
- Added a `v0.1.1` release candidate checklist for scope, required docs, verification, public data safety, tagging readiness, and post-release follow-up.
- Added roadmap review, contributor workflow map, feedback-to-issue, and public issue queue docs so maintainers can turn broad ideas into safe, scoped, verifiable GitHub issues.

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

`v0.1.1` improves open-source reviewer readiness, contributor onboarding, demo safety, CI reproduction, release process, dependency update guidance, workflow-level localization review, public issue preparation, and Codex for OSS application readiness for Open Warehouse System.

## Added

- OSS reviewer guide and Codex for OSS review evidence index.
- CI workflow guide and dependency update policy.
- README media plan, screenshot guidance, demo walkthrough, and demo seed dry-run notes.
- Maintainer handoff, release, privacy, deployment, PostgreSQL migration, and secret-handling checklists.
- Translation contribution guide, localization issue labels, and localization workflow review template.
- Codex for OSS form responses, repository health check, global-readiness review, and OSS reviewer FAQ.
- Roadmap review checklist, contributor workflow map, feedback-to-issue playbook, and public issue queue for scoped contributor work.

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
- Confirm application-facing docs still link to `docs/CODEX_FOR_OSS_FORM_RESPONSES.md`, `docs/REPOSITORY_HEALTH_CHECK.md`, `docs/GLOBAL_READINESS_REVIEW.md`, `docs/OSS_REVIEWER_FAQ.md`, `docs/ROADMAP_REVIEW_CHECKLIST.md`, `docs/CONTRIBUTOR_WORKFLOW_MAP.md`, and `docs/PUBLIC_ISSUE_QUEUE.md`.
- Create an annotated tag only after verification passes.
