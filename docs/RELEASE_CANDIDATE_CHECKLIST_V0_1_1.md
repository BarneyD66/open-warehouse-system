# Release Candidate Checklist: v0.1.1

Use this checklist before tagging `v0.1.1`. It is written for a documentation-only release candidate that packages the recent OSS reviewer, Codex for OSS application, demo-safety, localization, and maintainer-readiness work.

Status: draft checklist, not a release announcement.

## 1. Scope Check

Confirm the release candidate is documentation-only unless maintainers intentionally add code before tagging.

Expected release scope:

- Reviewer orientation and FAQ docs.
- Codex for OSS application draft, form responses, credit-use plan, and review evidence.
- Repository health, maintenance status, release notes, and public-readiness checks.
- Demo walkthrough, personas, fake-data guidance, public demo safety, and screenshot/media guidance.
- Global readiness, regional adaptation, localization workflow review, and translation contribution guidance.
- Community feedback, star/fork outreach, contributor onboarding, and good first issue materials.

If code, dependency, route, database, or generated asset changes are included, this checklist is no longer sufficient by itself.

## 2. Required Public Docs

Before tagging, confirm these files exist and render:

- `README.en.md`
- `CHANGELOG.md`
- `docs/RELEASE_NOTES_DRAFT_V0_1_1.md`
- `docs/RELEASE_PROCESS.md`
- `docs/OSS_REVIEWER_GUIDE.md`
- `docs/OSS_REVIEWER_FAQ.md`
- `docs/CODEX_FOR_OSS_REVIEW_EVIDENCE.md`
- `docs/CODEX_FOR_OSS_FORM_RESPONSES.md`
- `docs/CODEX_CREDIT_USE_PLAN.md`
- `docs/REPOSITORY_HEALTH_CHECK.md`
- `docs/MAINTENANCE_STATUS_2026_08.md`
- `docs/GLOBAL_READINESS_REVIEW.md`
- `docs/DEMO_PERSONAS.md`
- `docs/PUBLIC_DEMO_CHECKLIST.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`

## 3. Verification

For a documentation-only release candidate:

```bash
git diff --check
npm run lint
```

Before pushing or tagging, also confirm local and remote `main` match:

```bash
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

If any runtime files changed, also run:

```bash
npm run build
```

If database, schema, migration, or persistence files changed, also run:

```bash
npm run db:init
```

## 4. Public Data Safety

Reject the release candidate if staged files include:

- `.env.local`, database URLs, API keys, provider credentials, staff secrets, or production environment values.
- Real customer names, emails, phone numbers, addresses, labels, tracking numbers, invoices, or files.
- Payment proofs, private pricing sheets, warehouse documents, production screenshots, logs, uploads, or provider dashboards.
- Claims that the project is universally compliant, production-certified, carrier-approved, or a complete ERP/WMS replacement.

Use fake demo data and clearly scoped `0.x` language only.

## 5. Tagging Readiness

Before creating the tag:

- Move relevant `CHANGELOG.md` items from `Unreleased` into `v0.1.1 - YYYY-MM-DD`.
- Replace draft wording in the GitHub release body with final release wording.
- Confirm the commit range contains only intended public release content.
- Confirm no unrelated local product work is staged.
- Confirm `docs/RELEASE_NOTES_DRAFT_V0_1_1.md` is either kept as a historical draft or replaced by final release notes intentionally.

## 6. Suggested Tag Commands

Only run these after the checks above pass:

```bash
git tag -a v0.1.1 -m "v0.1.1"
git push origin v0.1.1
```

## 7. After Release

- Confirm the GitHub release points to the correct tag.
- Link follow-up issues instead of expanding the release scope late.
- Keep `docs/MAINTENANCE_STATUS_2026_08.md` and `docs/CODEX_FOR_OSS_REVIEW_EVIDENCE.md` current if the application review continues.
- Open small issues for seed data, Playwright smoke tests, PostgreSQL hardening, mobile warehouse scanning, and regional adaptation work.
