# Demo Walkthrough

This walkthrough gives reviewers and first-time contributors a safe route through the main Open Warehouse System surfaces.

Use it for local demos, public review, screenshots, short videos, and Codex for OSS application preparation. It is not a production acceptance test.

## Before You Start

Run the app locally:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

Use fake demo data only:

- Fake customer names and emails.
- Fake SKUs and order numbers.
- Fake warehouse addresses.
- Fake tracking numbers.
- Fake billing references.
- Fake carrier and marketplace examples.

Do not use real customer data, payment proofs, carrier credentials, production database URLs, private pricing sheets, logs, uploads, `.env.local` contents, or production screenshots.

## Walkthrough Route

### 1. Public Site

Routes:

- `/`
- `/services`
- `/pricing`
- `/inquiry`
- `/help`

What to check:

- The project positioning is clear: Chinese-first, global-ready, open-source WMS starter.
- The public pages explain warehouse, fulfillment, inventory, billing, returns, and 3PL operations without claiming out-of-the-box compliance in every country.
- Inquiry and pricing examples do not reveal private rates, customer names, or production contact data.

### 2. Customer Entry

Routes:

- `/login`
- `/portal`
- `/account`

What to check:

- A fake customer can understand the registration or login path.
- Portal sections make the customer workflow visible without staff-only data.
- Customer profile and account examples stay synthetic.

Safety notes:

- Do not use a real customer email.
- Do not paste private addresses, tax IDs, or payment details.
- If a screenshot is captured, follow `docs/PUBLIC_DEMO_CHECKLIST.md`.

### 3. Customer Warehouse Workflows

Routes:

- `/inbound`
- `/skus`
- `/outbound`
- `/returns`
- `/billing`
- `/tracking`

What to check:

- Inbound ASN, SKU, outbound, return/RMA, billing, and tracking surfaces are discoverable.
- Fake data can show how one warehouse story flows from customer request to ops review and warehouse action.
- Chinese-mode customer-facing templates, CSV/Excel headers, sample rows, and printable examples remain Chinese-first.

Suggested fake IDs:

- `DEMO-CUSTOMER-001`
- `SKU-DEMO-001`
- `ASN-DEMO-001`
- `OUT-DEMO-001`
- `RMA-DEMO-001`
- `TRK-DEMO-0001`

### 4. Ops Workbench

Routes:

- `/ops-login`
- `/ops`

What to check:

- Staff login is separate from customer login.
- Ops workflows can review leads, customer records, inbound/outbound progress, billing, exceptions, todos, and documents.
- Staff-only data is not presented as public customer data.

Safety notes:

- Do not publish real staff credentials.
- Do not show private support notes, internal pricing sheets, provider dashboards, or production logs.
- Use `docs/STAFF_AUTH.md` before changing staff access behavior.

### 5. Warehouse Workbench

Routes:

- `/warehouse`
- `/warehouse/print/*` when relevant

What to check:

- Receiving, putaway, picking, packing, handoff, locations, and print-oriented workflows are visible.
- Mobile or handheld review can focus on scanning and task action clarity.
- Print examples use fake SKUs, fake names, fake addresses, and fake tracking numbers.

### 6. Data Mode

For a lightweight local demo, use local fallback mode.

For PostgreSQL-oriented review:

```bash
docker compose up -d postgres
npm run db:init
```

Keep these notes separate:

- Data mode: local fallback or PostgreSQL.
- Fake customer used.
- Routes checked.
- Commands run.
- Screenshots captured, if any.

## Reviewer Notes Template

```markdown
## Demo Walkthrough Notes

- Date:
- Reviewer:
- Data mode:
- Routes checked:
- Fake customer:
- Fake records:
- Customer-facing language/export check:
- Staff/auth boundary notes:
- Screenshots or video:
- Verification commands:
- Follow-up issues:
```

## Reject Criteria

Do not publish demo notes, screenshots, or videos if they contain:

- Real customer data.
- Production URLs, database URLs, environment variables, or `.env.local` contents.
- Real carrier credentials, labels, webhook payloads, or provider dashboards.
- Payment proofs, invoices, bank details, or private pricing.
- Browser bookmarks, private accounts, chats, notifications, or unrelated tabs.
- Claims about tax, customs, privacy, labor, or carrier compliance that were not validated for the target region.

## Related Docs

- `docs/OSS_REVIEWER_GUIDE.md`
- `docs/PUBLIC_DEMO_CHECKLIST.md`
- `docs/SMOKE_TEST_PLAN.md`
- `docs/DEMO_DATA_PLAN.md`
- `docs/DEMO_SEED_DATA_GUIDE.md`
- `docs/LOCAL_POSTGRESQL.md`
- `docs/STAFF_AUTH.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
