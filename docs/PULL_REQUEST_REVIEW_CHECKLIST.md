# Pull Request Review Checklist

Use this checklist when reviewing changes from maintainers or external contributors. It is intentionally practical: every accepted pull request should improve one clear workflow without weakening data safety, auth boundaries, or the Chinese-first customer experience.

## Scope

- The pull request solves one clear issue or workflow problem.
- The diff avoids unrelated refactors, formatting churn, generated files, logs, and local data.
- Public docs and examples use fake demo data only.
- The change does not commit `.env.local`, production URLs, warehouse addresses, carrier credentials, payment proofs, customer names, or private pricing sheets.

## Verification

- Documentation-only changes ran `git diff --check`.
- Code changes ran `npm run lint`.
- Behavior changes include either `npm run build`, an automated test, or a manual route check.
- Smoke notes follow `docs/SMOKE_TEST_PLAN.md` for the affected surface.
- The pull request description names the checked routes, scripts, or files.
- Screenshots, if included, follow `docs/SCREENSHOT_GUIDE.md` and use fake demo data.

## Data And Auth Safety

- Customer-facing reads and writes remain isolated by `customer_code` or the relevant customer identity boundary.
- Staff-only APIs still require staff session validation.
- File, document, billing, payment proof, and download routes do not expose data across customers.
- Audit, notification, and exception records do not leak private operational details into public examples.
- Security-sensitive findings are moved to the security reporting process instead of public issue comments.

## Warehouse Workflow Risk

Apply stricter review when a change touches:

- Inventory balance, movement log, adjustment, stocktake, or replenishment logic.
- Receiving, putaway, picking, packing, handoff, scanning, or print templates.
- Outbound shipping, carrier rules, labels, tracking, webhooks, or delivery exceptions.
- Billing statement generation, payment proof review, dispute handling, or reconciliation.
- Return/RMA inspection, customer resolution, restock, or refund evidence.

For these areas, require clear verification notes and safe rollback or manual recovery guidance when practical.

## Internationalization

- Chinese-mode customer-facing pages, backend copy shown to customers, downloadable templates, CSV/Excel headers, and sample rows remain Chinese-first.
- Internal English aliases are acceptable for compatibility, but they should not leak into customer-facing exports unless explicitly documented.
- Region-specific behavior is described as configurable or deployment-specific, not as universal legal, tax, customs, carrier, privacy, or labor compliance.
- New examples avoid implying that real carrier accounts, tax rules, or customs settings are included by default.

## Contributor Feedback

- Ask for smaller PRs when the change mixes unrelated docs, UI, API, migration, and test work.
- Prefer concrete acceptance criteria over broad roadmap discussion.
- Link relevant docs such as `docs/ISSUE_TRIAGE_LABELS.md`, `docs/CONTRIBUTOR_QUICK_PATH.md`, `docs/LOCAL_POSTGRESQL.md`, or `SECURITY.md`.
- If the work is suitable for a new contributor, keep feedback specific enough that they can finish without private project context.
