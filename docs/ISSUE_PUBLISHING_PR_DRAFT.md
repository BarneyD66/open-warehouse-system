# Pull Request Draft: Issue Publishing Safety

Use this draft when opening a pull request from `agent/docs-issue-publishing-checklist` into `main`.

## Title

```text
docs: add issue publishing safety workflow
```

## Body

```md
## Summary

This PR adds a small documentation workflow for publishing and responding to public GitHub issues safely during the Open Warehouse System `0.x` and Codex for OSS review period.

## What Changed

- Added `docs/ISSUE_PUBLISHING_CHECKLIST.md` for checking public safety, workflow scope, labels, acceptance criteria, and verification before creating GitHub issues.
- Added `docs/FIRST_ISSUE_RESPONSE_TEMPLATE.md` with maintainer reply templates for acknowledgement, reproduction requests, scope reduction, unsafe-data redaction, regional-claim clarification, and closing not-publicly-actionable issues.
- Updated `docs/PUBLIC_ISSUE_QUEUE.md` so queued issue drafts point maintainers to the publishing checklist and first-response templates.
- Updated reviewer and release materials so the issue publishing workflow appears in `v0.1.1` draft release notes, Codex for OSS review evidence, maintenance status, maintenance log, README, and changelog.

## Why It Matters

The project already has public issue drafts and contributor guidance. This PR closes the next operational gap: what maintainers should check before publishing an issue, and how to respond when contributors report problems without exposing real customer data, credentials, logs, labels, invoices, private pricing, or production screenshots.

## Data Safety

- Documentation-only change.
- Uses fictional example IDs only.
- Does not add customer data, production screenshots, logs, `.env.local`, provider credentials, database URLs, labels, invoices, payment proofs, or private pricing sheets.
- Does not claim production readiness or universal regional compliance.

## Verification

- `git diff --check`
- `npm run lint`
- `git show --check --format=short HEAD`

## Follow-up

After merge, maintainers can publish one small issue from `docs/PUBLIC_ISSUE_QUEUE.md` and use `docs/FIRST_ISSUE_RESPONSE_TEMPLATE.md` for the first public maintainer reply.
```

## Pre-Merge Checklist

- Confirm the branch contains docs-only changes.
- Confirm `CHANGELOG.md` mentions the new issue publishing and first-response docs.
- Confirm `README.en.md` links to both new docs.
- Confirm no unrelated local work is included in the PR.
- Confirm validation commands are listed in the PR body.
