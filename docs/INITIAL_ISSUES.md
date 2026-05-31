# Initial Issues

公开仓库后，可以把下面这些 issue 复制到 GitHub。建议先打上 `good first issue`、`help wanted`、`documentation`、`test`、`backend`、`frontend` 等标签。

## 1. Add seed data for local demo

Labels: `good first issue`, `developer-experience`

Create a seed script that initializes demo customers, SKUs, inbound ASNs, outbound orders, inventory balances, billing records, and return orders. The goal is to let new contributors run the app locally and immediately see realistic warehouse workflows.

Acceptance criteria:

- `npm run seed` or similar command exists.
- Seed data contains no real customer information.
- README documents how to reset and seed local data.

## 2. Add Docker Compose for local PostgreSQL

Labels: `good first issue`, `backend`, `developer-experience`

Add a `docker-compose.yml` for local PostgreSQL development and document how to use it with `.env.local`.

Acceptance criteria:

- `docker compose up -d` starts PostgreSQL.
- `npm run db:init` works against the local database.
- Documentation explains connection string setup.

## 3. Add architecture diagram to README

Labels: `documentation`

Turn the high-level flow in `docs/ARCHITECTURE.md` into a concise README section so first-time visitors can understand the customer, ops, warehouse, and data boundaries.

Acceptance criteria:

- README includes a short architecture section.
- Mermaid diagram renders on GitHub.
- Chinese explanation remains readable.

## 4. Add Playwright smoke test for customer registration

Labels: `test`, `frontend`

Add a Playwright test covering customer registration, login, portal entry, logout, and login again.

Acceptance criteria:

- Test uses safe demo data.
- Test can run locally without production secrets.
- CI can be extended to run it later.

## 5. Harden production staff auth documentation

Labels: `security`, `documentation`

Improve docs for `STAFF_WHITELIST_JSON`, demo login switches, session secrets, and production deployment checks.

Acceptance criteria:

- Example whitelist JSON is documented.
- Docs explain why demo login must stay disabled in production.
- No real credentials are included.

## 6. Convert one local fallback store to PostgreSQL-backed repository

Labels: `backend`, `help wanted`

Choose one workflow currently backed by local fallback data and move it toward a PostgreSQL repository pattern.

Acceptance criteria:

- Existing behavior remains compatible.
- PostgreSQL schema or migration is documented.
- Local fallback mode still works for demo usage.

## 7. Improve mobile warehouse workbench

Labels: `frontend`, `warehouse`, `help wanted`

Review `/warehouse` at mobile widths and improve scanning, task selection, and action controls.

Acceptance criteria:

- No horizontal overflow at 390px width.
- Main task actions are reachable without awkward scrolling.
- UI remains dense and work-focused.

## 8. Add carrier adapter interface

Labels: `backend`, `logistics`

Design an interface for carrier integrations such as rate quoting, label creation, tracking upload, and webhook ingestion.

Acceptance criteria:

- Types clearly separate internal shipment data from carrier-specific payloads.
- Mock carrier implementation exists.
- README or docs explain how to add a new carrier.

## 9. Add CSV import/export documentation

Labels: `documentation`, `inventory`

Document SKU, inventory, location, and outbound CSV import/export expectations. Customer-facing templates should keep Chinese headers and examples.

Acceptance criteria:

- Docs include sample CSV headers.
- Chinese customer-facing labels are preserved.
- Internal English field aliases, if needed, are explained as implementation details.

## 10. Add CHANGELOG

Labels: `good first issue`, `documentation`

Create `CHANGELOG.md` and document the v0.1.0 open-source launch.

Acceptance criteria:

- Uses a simple Keep a Changelog style.
- Includes v0.1.0 launch notes.
- Links to roadmap where useful.
