# Repository Health Check

Use this checklist when the repository needs a quick public-readiness review for maintainers, contributors, or Codex for OSS reviewers.

Run it:

- Weekly while the project is under active OSS review.
- Before sharing the repository in application materials.
- Before tagging `v0.1.1` or another public documentation release.
- After a batch of documentation-only maintenance commits.

## 1. Repository State

Confirm the local branch and the public branch are easy to compare:

```bash
git status --short --branch
git log --oneline -n 5
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected result:

- The current branch is `main`.
- The latest local commit is pushed to `origin/main`.
- Any unrelated local files are not staged for public commits.

## 2. Public Documentation Index

Check that the main public entry points still point to current materials:

- `README.en.md` links the active setup, safety, contributor, release, and review docs.
- `CHANGELOG.md` includes recent public-facing documentation and workflow changes.
- `docs/CODEX_FOR_OSS_REVIEW_EVIDENCE.md` summarizes reviewer-facing evidence.
- `docs/OSS_REVIEWER_GUIDE.md` gives a fast review path.
- `docs/RELEASE_NOTES_DRAFT_V0_1_1.md` is still clearly marked as a draft until the tag is published.

## 3. Public Data Safety

Before pushing, confirm the staged files do not include:

- `.env.local`, production `.env` files, database URLs, API keys, or provider credentials.
- Real customer names, addresses, phone numbers, emails, invoices, payment proofs, labels, or tracking numbers.
- Private pricing sheets, carrier contracts, warehouse logs, production screenshots, or uploaded files.
- Local dev logs, generated browser screenshots, or temporary verification folders.

Use fake demo records and redacted examples only.

## 4. Contributor Readiness

Check that a new contributor can find a small and safe starting point:

- `docs/CONTRIBUTOR_QUICK_PATH.md` explains the shortest first contribution route.
- `docs/GOOD_FIRST_ISSUE_DRAFTS.md` has copy-ready starter issues.
- `docs/ISSUE_TRIAGE_LABELS.md` explains how `good first issue`, `help wanted`, `localization`, and `internationalization` should be used.
- `docs/TRANSLATION_CONTRIBUTION_GUIDE.md` and `docs/LOCALIZATION_WORKFLOW_REVIEW_TEMPLATE.md` explain workflow-level localization before translating UI text.

## 5. Verification

For documentation-only changes:

```bash
git diff --check
npm run lint
```

For code, configuration, dependency, database, or behavior changes, also run the relevant project checks, usually:

```bash
npm run build
```

For PostgreSQL or schema changes, include the setup and migration checks documented in `docs/LOCAL_POSTGRESQL.md` and `docs/POSTGRES_MIGRATION_REVIEW_CHECKLIST.md`.

## 6. Review Note Template

Use this short note in a pull request, release draft, or maintenance commit summary:

```text
Repository health check:
- Scope: docs-only / code / config / data model
- Public data safety: checked, no secrets or real customer data staged
- Verification: git diff --check; npm run lint
- Remote sync: local HEAD matches origin/main after push
- Follow-up: one next small contributor-friendly issue
```
