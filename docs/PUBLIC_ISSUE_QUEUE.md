# Public Issue Queue

This queue helps maintainers publish small, reviewable GitHub issues during the Open Warehouse System `0.x` phase.

Use it after `docs/ROADMAP_REVIEW_CHECKLIST.md`, `docs/CONTRIBUTOR_WORKFLOW_MAP.md`, and `docs/ISSUE_PUBLISHING_CHECKLIST.md`. Each item below is intentionally narrow, safe for public review, and designed to avoid real customer data, production credentials, private pricing sheets, logs, labels, invoices, or `.env.local`.

## Queue Rules

- Publish one issue at a time.
- Keep the scope to one route, workflow, document, or verification path.
- Use fake demo records only.
- Include labels, acceptance criteria, and verification commands.
- Run `docs/ISSUE_PUBLISHING_CHECKLIST.md` before copying a draft into GitHub.
- Close or rewrite issues that require private documents or production integrations.

## Ready-To-Publish Issues

### 1. Document one safe outbound demo path

Suggested labels: `good first issue`, `documentation`, `warehouse`

Summary:

Document a fake pick-pack-ship path that a contributor can follow through customer, ops, and warehouse surfaces without production data.

Acceptance criteria:

- Pick one fake outbound order ID, such as `OUT-DEMO-0001`.
- Document the expected states from order creation to warehouse handoff.
- Link to `docs/DEMO_WALKTHROUGH.md` and `docs/CONTRIBUTOR_WORKFLOW_MAP.md`.
- State that labels, tracking numbers, and customer addresses must be fake.
- Run `git diff --check`.

### 2. Add a smoke-test checklist for `/tracking`

Suggested labels: `good first issue`, `test`, `documentation`

Summary:

Add a small manual or automated smoke-test note for the public tracking route.

Acceptance criteria:

- Verify `/tracking` loads with no production service dependency.
- Use fake tracking values only, such as `TRK-DEMO-0001`.
- Document the expected empty, found, and not-found states.
- Link to `docs/SMOKE_TEST_PLAN.md`.
- Run `git diff --check`; run `npm run lint` if code is changed.

### 3. Review one billing export for localization readiness

Suggested labels: `good first issue`, `documentation`, `localization`, `billing`

Summary:

Review one billing export or statement workflow and document which labels are customer-facing.

Acceptance criteria:

- Use fake customer, statement, and charge rows only.
- Keep Chinese-mode customer-facing headers and examples Chinese-first.
- Treat English field names as internal aliases unless a complete alternate locale is proposed.
- Link to `docs/EXPORT_LOCALIZATION_CHECKLIST.md` and `docs/LOCALIZATION_WORKFLOW_REVIEW_TEMPLATE.md`.
- Run `git diff --check`.

### 4. Draft a PostgreSQL migration note for one fallback store

Suggested labels: `backend`, `documentation`, `postgresql`

Summary:

Choose one local fallback store and document what would be required to move it toward PostgreSQL-backed persistence.

Acceptance criteria:

- Identify the current store or workflow boundary.
- Describe the expected table or repository shape at a high level.
- Include rollback and local-demo compatibility notes.
- Link to `docs/POSTGRES_MIGRATION_REVIEW_CHECKLIST.md` and `docs/LOCAL_POSTGRESQL.md`.
- Run `git diff --check`.

### 5. Improve one mobile warehouse checklist

Suggested labels: `frontend`, `warehouse`, `documentation`

Summary:

Review one mobile warehouse task path and document what a contributor should check before changing UI.

Acceptance criteria:

- Choose one route or workflow, such as `/warehouse`, `/pda`, receiving, picking, or packing.
- Note scan input, manual fallback, error state, and print/export boundaries.
- Avoid real device, carrier, or printer assumptions.
- Link to `docs/CONTRIBUTOR_WORKFLOW_MAP.md` and `docs/SMOKE_TEST_PLAN.md`.
- Run `git diff --check`; run `npm run lint` if code is changed.

### 6. Add a region profile example skeleton

Suggested labels: `documentation`, `internationalization`, `help wanted`

Summary:

Add a fake region profile example skeleton that shows how to document assumptions without claiming compliance.

Acceptance criteria:

- Use a fictional or clearly generic region example.
- Cover language, address, carrier, tax, customs, privacy, billing, and export assumptions.
- State that the project is region-adaptable, not universally compliant by default.
- Link to `docs/REGION_PROFILE_TEMPLATE.md` and `docs/REGIONAL_ADAPTATION_GUIDE.md`.
- Run `git diff --check`.

### 7. Map one community feedback note into an issue

Suggested labels: `documentation`, `triage`, `help wanted`

Summary:

Take one public, non-sensitive feedback note and convert it into a reproducible GitHub issue.

Acceptance criteria:

- Remove names, addresses, screenshots, logs, credentials, and private business details.
- Identify the affected route, workflow, expected behavior, and verification command.
- Link to `docs/FEEDBACK_TO_ISSUE_PLAYBOOK.md`.
- Add labels from `docs/ISSUE_TRIAGE_LABELS.md`.
- Run `git diff --check`.

## Publishing Checklist

Before creating the GitHub issue:

- Confirm the issue can be reviewed without production access.
- Confirm the issue has one clear owner role.
- Confirm it links to the relevant docs.
- Confirm verification is possible on a local checkout.
- Confirm any examples are fictional.

After publishing:

- Add labels.
- Cross-link related docs or prior issues.
- Reply with a scoped maintainer note from `docs/FIRST_ISSUE_RESPONSE_TEMPLATE.md`.
- Invite contributors to ask clarifying questions before broadening scope.
- Close stale issues that drift into private integrations or production data.
