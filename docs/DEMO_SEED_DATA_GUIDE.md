# Demo Seed Data Guide

This guide defines how contributors should design, review, and eventually implement demo seed data for Open Warehouse System.

The project does not currently ship a `npm run seed:demo` command. Until that command exists, use this guide as the contract for safe demo records, screenshots, smoke tests, and contributor examples.

For a small first contribution before implementing the command, see the safe demo seed dry-run issue draft in `docs/GOOD_FIRST_ISSUE_DRAFTS.md`.

## Goals

- Make local demos understandable without using private warehouse data.
- Keep examples realistic enough to show inbound, inventory, outbound, returns, billing, logistics, and staff review workflows.
- Keep demo data deterministic so screenshots, docs, and tests do not drift.
- Keep Chinese-mode customer-facing text, templates, CSV/Excel headers, and sample rows Chinese-first.
- Keep internal identifiers English-readable for contributors.

## Hard Rules

Demo seed data must not include:

- Real customer names, real contacts, real phone numbers, or real email addresses.
- Real warehouse addresses, account numbers, VAT/EORI values, payment proofs, invoices, or private pricing.
- Real carrier credentials, production tracking tokens, webhook secrets, labels, or documents.
- Production database URLs, `.env.local`, logs, uploads, or files copied from a live customer workspace.

Use fake values that are visibly synthetic, such as `example.com`, `example.test`, `DEMO-CN-UK-001`, `TRK-DEMO-0001`, and placeholder addresses.

## Recommended Scenario Shape

A useful demo seed should cover one complete cross-border warehouse story:

- Customer onboarding and profile review.
- SKU creation with Chinese and English product names.
- Inbound ASN and receiving workflow.
- Inventory balance and movement history.
- Outbound order, picking, packing, handoff, and tracking.
- Return/RMA inspection and customer resolution.
- Billing statement with traceable fee lines.
- Staff notification or todo for an exception.

This is more useful than isolated records because contributors can trace why data exists across the customer portal, ops workbench, warehouse workbench, billing, and tracking pages.

## Suggested Record Set

Start small:

| Area | Minimum Records | Notes |
| --- | ---: | --- |
| Customers | 2 | One verified customer and one pending-review customer. |
| SKUs | 6 | Include small parcel, medium parcel, heavy item, oversized item, return-sensitive item, and FBA prep item. |
| Inbound ASNs | 2 | One normal carton inbound and one pallet or exception example. |
| Inventory balances | 6 | Include available, reserved, inbound, defective, low-stock, and long-aging examples. |
| Outbounds | 4 | Include small parcel, multi-item, address exception, and handoff completed examples. |
| Returns | 2 | Include relabeling and inspection/photo-feedback cases. |
| Billing lines | 8 | Link fees back to inbound, storage, outbound, carrier, return, and value-added-service events. |
| Notifications | 4 | Include missing document, inbound exception, low stock, and billing review reminders. |

## Future Command Contract

When the project adds a seed command, it should behave like this:

```bash
npm run seed:demo
```

Expected behavior:

- Refuse to run when `NODE_ENV=production`.
- Print whether it is using local fallback storage or PostgreSQL.
- Create only deterministic fake demo records.
- Be safe to rerun without duplicating records.
- Use stable demo IDs and customer codes.
- Print a short summary of created or updated records.
- Never read from production files, uploads, logs, or private spreadsheets.

If a reset command is added later:

```bash
npm run reset:demo
```

Expected behavior:

- Refuse to run when `NODE_ENV=production`.
- Remove only records marked as demo data.
- Never delete unknown customer data or production-like records.
- Ask maintainers to use `docs/LOCAL_DEMO_RESET.md` for local fallback cleanup.

## Review Checklist

Before merging demo seed work:

- Run `npm run lint`.
- Run `npm run build` if seed code or app behavior changed.
- Run `git diff --check` for docs and seed files.
- Confirm generated data is visibly fake.
- Confirm customer data isolation still works across demo customers.
- Confirm Chinese-mode customer-facing exports, templates, and sample rows remain Chinese-first.
- Confirm no `.env.local`, `.local-data`, logs, uploads, payment proofs, real labels, or production documents are staged.

## Related Docs

- `docs/DEMO_DATA_PLAN.md`
- `docs/GOOD_FIRST_ISSUE_DRAFTS.md`
- `docs/LOCAL_DEMO_RESET.md`
- `docs/LOCAL_POSTGRESQL.md`
- `docs/SCREENSHOT_GUIDE.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `SECURITY.md`
