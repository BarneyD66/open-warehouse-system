# Smoke Test Plan

This plan gives contributors and maintainers a small verification path before opening or merging pull requests.

It is not a full regression suite. It is a practical smoke checklist for the main Open Warehouse System surfaces: customer portal, ops workbench, warehouse workbench, tracking, local persistence, and documentation-only changes.

## Baseline Commands

Run these for most code changes:

```bash
npm run lint
npm run build
```

For documentation-only changes:

```bash
git diff --check
```

For PostgreSQL or schema-related changes:

```bash
npm run db:init
```

Use local fake data only. Do not use real customer records, production URLs, carrier credentials, payment proofs, private warehouse addresses, logs, uploads, or `.env.local` contents in smoke notes.

## Local App Start

1. Copy environment defaults if needed:

```bash
cp .env.example .env.local
```

2. Start the app:

```bash
npm run dev
```

3. Open <http://localhost:3000>.

If you use PostgreSQL, start it first with `docs/DOCKER_COMPOSE_RUNBOOK.md`.

## Customer Surface

Check the customer path when a change affects registration, login, portal copy, inbound, SKU, outbound, returns, billing, files, notifications, or customer-facing exports.

- Visit `/login`.
- Register or log in with fake local data.
- Visit `/portal`.
- Confirm the page does not expose another customer's records.
- Check any changed customer workflow route.
- Confirm Chinese-mode customer-facing templates, CSV/Excel headers, and sample rows remain Chinese-first.

Suggested evidence:

- Route checked.
- Fake customer code or synthetic account used.
- Any manual action completed.
- Screenshot only if it uses fake data and follows `docs/SCREENSHOT_GUIDE.md`.

## Ops Surface

Check the ops path when a change affects lead review, customer review, inbound/outbound progress, billing review, exceptions, todos, reporting, integrations, or staff-only APIs.

- Visit `/ops-login`.
- Log in with a local demo or configured staff account.
- Visit `/ops`.
- Confirm staff-only pages are not reachable from a customer session.
- Check the changed panel, report, or workflow.
- Confirm no private operational data appears in public docs, screenshots, or issue comments.

Suggested evidence:

- Route checked.
- Staff role or demo staff mode used.
- Changed panel or API verified.
- Data isolation or auth boundary note if relevant.

## Warehouse Surface

Check the warehouse path when a change affects receiving, putaway, picking, packing, handoff, scanning, labels, pick lists, return labels, or location work.

- Visit `/warehouse`.
- Check the relevant task list, scan flow, print page, or workflow action.
- Confirm inventory-affecting behavior has clear verification notes.
- Confirm print examples and screenshots use fake SKUs, fake addresses, and fake tracking numbers.

Suggested evidence:

- Warehouse route checked.
- Task type checked.
- Inventory, print, scan, or handoff behavior verified.

## Tracking Surface

Check tracking when a change affects shipment status, public tracking lookup, carrier event mapping, delivery exceptions, or customer notifications.

- Visit `/tracking`.
- Use a fake tracking number.
- Confirm public tracking output does not expose internal staff notes, private customer data, carrier credentials, or account numbers.

## PostgreSQL Path

Use this path when a change touches schema, migration scripts, persistence helpers, or repository behavior.

- Start PostgreSQL with `docker compose up -d postgres`.
- Confirm health with `docker compose ps`.
- Set `POSTGRES_URL=postgres://warehouse:warehouse@localhost:5432/open_warehouse_system` in `.env.local`.
- Run `npm run db:init`.
- Run the changed workflow against PostgreSQL if practical.

Keep local fallback and PostgreSQL notes separate in pull request verification.

## Documentation-only Path

For docs, templates, issue text, release notes, and contributor guidance:

- Run `git diff --check`.
- Confirm links point to existing files.
- Confirm examples use fake data.
- Confirm no `.env.local`, logs, customer data, production screenshots, private documents, or pricing sheets are referenced.

## Pull Request Smoke Notes Template

```markdown
## Smoke Checks

- Commands:
- Routes:
- Data mode: local fallback / PostgreSQL / docs only
- Fake data used:
- Auth or data isolation notes:
- Customer-facing language/export notes:
- Screenshots: yes/no, fake data confirmed
```

## Related Docs

- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `docs/CONTRIBUTOR_ONBOARDING.md`
- `docs/DOCKER_COMPOSE_RUNBOOK.md`
- `docs/LOCAL_POSTGRESQL.md`
- `docs/SCREENSHOT_GUIDE.md`
- `SECURITY.md`
