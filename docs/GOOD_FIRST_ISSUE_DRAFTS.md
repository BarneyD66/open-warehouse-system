# Good First Issue Drafts

These drafts can be copied into GitHub Issues when the maintainers want to invite first-time contributors.

Keep each issue small. A good first issue should have a clear file or route, clear acceptance criteria, and no need for real customer data, production credentials, logs, private pricing sheets, or `.env.local`.

## 1. Document CSV import and export examples

Suggested labels: `good first issue`, `documentation`, `inventory`

### Summary

Add a short documentation page that explains the expected CSV import and export formats for SKU, inventory, location, and outbound workflows.

### Context

Open Warehouse System has several customer and warehouse workflows that rely on CSV import/export. New contributors and warehouse operators need a safe reference that shows fake example rows and explains which columns are customer-facing.

### Acceptance criteria

- Add a doc under `docs/`.
- Include sample headers for SKU, inventory, location, and outbound CSV workflows.
- Use fake customer names, fake SKUs, fake order numbers, and fake tracking numbers.
- Keep Chinese-mode customer-facing headers and examples Chinese-first.
- If English field names are useful, describe them as internal aliases rather than customer-facing export headers.
- Run `git diff --check`.

## 2. Add a Playwright smoke test for the public homepage

Suggested labels: `good first issue`, `test`, `frontend`

### Summary

Add a small Playwright smoke test that opens the public homepage and verifies the main navigation routes are reachable.

### Context

The project already uses Playwright for browser verification. A very small public-page smoke test would make it easier to expand automated coverage later without needing customer, staff, or production credentials.

### Acceptance criteria

- Add a Playwright test file in the existing test structure or create a minimal documented location if no test directory exists yet.
- Verify that `/` loads successfully.
- Verify links or direct navigation for `/login`, `/services`, `/pricing`, and `/tracking`.
- Do not require real customer data or production services.
- Document how to run the test if a new command is needed.
- Run `npm run lint`.

## 3. Improve local demo reset instructions

Suggested labels: `good first issue`, `developer-experience`, `documentation`

### Summary

Document how a local contributor can reset demo data safely when using local JSON fallback mode.

### Context

The app can run without PostgreSQL using local fallback stores. Contributors need a clear way to understand which local files are generated, which files must not be committed, and how to return to a clean local state.

### Acceptance criteria

- Add or update a doc under `docs/`.
- Explain local JSON fallback mode in plain English.
- Mention `.local-data` as local-only generated data that must not be committed.
- Include a safe reset checklist that does not delete unrelated files.
- Link to `docs/DEMO_DATA_PLAN.md` and `docs/LOCAL_POSTGRESQL.md`.
- Run `git diff --check`.

## 4. Refine the README architecture diagram

Suggested labels: `good first issue`, `documentation`, `architecture`

Status: baseline Mermaid diagram exists in `README.en.md`; future issues can refine it when major surfaces or persistence boundaries change.

### Summary

Refine the compact Mermaid diagram in `README.en.md` so it stays accurate as customer, ops, warehouse, API, integration, and persistence boundaries evolve.

### Context

First-time visitors should be able to understand the main surfaces without reading the full architecture document.

### Acceptance criteria

- Keep one compact Mermaid diagram in `README.en.md`.
- Show at least these surfaces when they are relevant: public site, customer portal, ops workbench, warehouse workbench, API routes, local fallback data, and PostgreSQL.
- Link to `docs/ARCHITECTURE.md` for details.
- Keep the README readable and not too long.
- Run `git diff --check`.

## 5. Add contributor screenshots checklist to pull request template

Suggested labels: `good first issue`, `documentation`, `developer-experience`

### Summary

Update `.github/pull_request_template.md` so UI contributors know what screenshots to include for customer, ops, and warehouse changes.

### Context

The project has screenshot guidance in `docs/SCREENSHOT_GUIDE.md`. The PR template should point contributors to the same expectations when they change UI.

### Acceptance criteria

- Update `.github/pull_request_template.md`.
- Link to `docs/SCREENSHOT_GUIDE.md`.
- Ask for desktop and mobile screenshots when UI changes affect customer, ops, or warehouse pages.
- Remind contributors to use fake demo data only.
- Run `git diff --check`.

## 6. Clarify carrier adapter mock scope

Suggested labels: `good first issue`, `logistics`, `documentation`

Status: baseline design doc exists in `docs/MOCK_CARRIER_ADAPTER.md`; future issues can refine the interface or add tests.

### Summary

Write a short design note for a mock carrier adapter that can support rate quoting, label creation, tracking events, and webhook-like updates without real carrier credentials.

### Context

Carrier integration is important for warehouse operations, but first contributors should not need Royal Mail, DPD, Evri, DHL, or other production credentials.

### Acceptance criteria

- Add a doc under `docs/`.
- Describe a mock carrier adapter interface at a high level.
- Cover rate quote, label creation, tracking update, and error simulation.
- Explicitly state that real carrier credentials must not be committed.
- Link to `SECURITY.md` and `docs/STAFF_AUTH.md` where relevant.
- Run `git diff --check`.

## 7. Draft a safe demo seed dry-run plan

Suggested labels: `good first issue`, `developer-experience`, `documentation`

### Summary

Add a small contributor-facing plan for a future `npm run seed:demo -- --dry-run` workflow that can preview fake demo records without writing to local fallback data or PostgreSQL.

### Context

Open Warehouse System needs safe demo seed data so reviewers and first-time contributors can understand customer, ops, warehouse, returns, billing, and tracking workflows quickly. A dry-run plan is a low-risk first step before implementing seed scripts because it lets contributors agree on record shape, IDs, safety checks, and verification expectations.

### Acceptance criteria

- Add or update a doc under `docs/`.
- Base the plan on `docs/DEMO_SEED_DATA_GUIDE.md`.
- Use `docs/DEMO_SEED_DRY_RUN_EXAMPLE.md` as the expected output baseline.
- Explain what the dry-run command should print without writing data.
- Include fake examples only, such as `DEMO-CUSTOMER-001`, `SKU-DEMO-001`, and `TRK-DEMO-0001`.
- State that the command must refuse production mode and must not read `.env.local`, logs, uploads, private spreadsheets, or production database URLs.
- Include expected verification commands: `git diff --check` for docs-only work and `npm run lint` if script code is added.
- Keep Chinese-mode customer-facing examples, templates, CSV/Excel headers, and sample rows Chinese-first.
