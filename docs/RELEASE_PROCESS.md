# Release Process

This guide describes how maintainers should prepare small `0.x` releases for Open Warehouse System. The project is still an early open-source WMS starter, so releases should be frequent, understandable, and explicit about setup, data safety, and workflow risk.

## Release Principles

- Keep releases small enough to review from the changelog and commit history.
- Explain warehouse workflow impact in practical terms: customer portal, ops workbench, warehouse workbench, inventory, billing, returns, logistics, auth, or docs.
- Use fake demo data in release notes, screenshots, and examples.
- Do not include real customer names, warehouse addresses, carrier credentials, payment proofs, production logs, production URLs, `.env.local`, or private pricing sheets.
- Treat region-specific behavior as configurable guidance, not a claim of universal legal, tax, customs, carrier, privacy, or labor compliance.

## Versioning

Use lightweight `0.x` versioning until the public API and core workflow contracts are stable.

- Patch releases, such as `v0.1.1`, should contain docs, setup fixes, bug fixes, demo data improvements, or small workflow hardening.
- Minor releases, such as `v0.2.0`, should group larger visible improvements, database setup changes, or new workflow foundations.
- Avoid major-version language until the project has stable deployment, migration, and integration contracts.

## Release Checklist

Before creating a tag:

- Confirm `CHANGELOG.md` has an `Unreleased` summary with setup, security, migration, and contributor-facing notes.
- Move release-ready notes from `Unreleased` into a dated version section.
- Run `npm run lint`.
- Run `npm run build` when code, routes, Next.js configuration, or database behavior changed.
- Run `git diff --check` for documentation changes.
- Review `docs/DEPENDENCY_UPDATE_POLICY.md` when a release includes package, lockfile, CI runtime, or build-tool changes.
- Confirm `.env.local`, local data, logs, screenshots with private data, and production documents are not staged.
- Review `SECURITY.md` if the release touches auth, staff access, customer isolation, file downloads, billing, carrier credentials, or webhooks.
- Review `docs/PULL_REQUEST_REVIEW_CHECKLIST.md` for changes that affect inventory, billing, logistics, returns, warehouse execution, or customer-facing exports.

## Tagging

Use annotated tags for public release points:

```bash
git tag -a v0.1.1 -m "v0.1.1"
git push origin v0.1.1
```

If a release is documentation-only, say that clearly in the GitHub release notes. If it changes setup or runtime behavior, include the required migration or configuration steps.

## Release Notes Template

```markdown
## Summary

- One or two bullets describing the release in workflow terms.

## Added

- New contributor, setup, demo data, or workflow capabilities.

## Changed

- Behavior, documentation, configuration, or UI changes.

## Security And Data Safety

- Auth, customer isolation, file access, billing, carrier, or secret-handling notes.

## Verification

- `npm run lint`
- `npm run build` if applicable
- `git diff --check`
- Manual route checks if applicable

## Migration Or Setup Notes

- Required environment variables, database steps, seed data changes, or deployment notes.
```

## After Release

- Confirm the GitHub release links to the correct tag.
- Open follow-up issues for deferred work instead of hiding it in release notes.
- Keep `docs/INITIAL_ISSUES.md` and `docs/GOOD_FIRST_ISSUE_DRAFTS.md` aligned with the next contributor-friendly tasks.
- Update `docs/CODEX_FOR_OSS_APPLICATION_EN.md` only when the release materially improves open-source value.
