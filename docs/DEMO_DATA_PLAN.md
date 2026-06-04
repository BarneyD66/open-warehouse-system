# Demo Data Plan

This document defines the safe demo dataset that should eventually power local development, screenshots, smoke tests, and contributor onboarding.

The goal is to make the project understandable within a few minutes after `npm run dev`, without relying on real customers, production files, carrier credentials, payment proofs, or private warehouse data.

## Principles

- Use fully fake customers, contacts, addresses, phone numbers, emails, SKUs, orders, tracking numbers, and billing records.
- Keep all customer-facing labels Chinese-first where the workflow is Chinese-facing.
- Keep internal aliases English-readable for contributors.
- Cover a realistic end-to-end warehouse workflow rather than isolated records.
- Make the dataset deterministic so screenshots, tests, and documentation do not drift.
- Avoid real carrier account numbers, real labels, real payment proofs, real invoices, and real customer documents.

## Suggested Demo Scenario

Use one primary cross-border seller and one secondary customer:

| Demo Customer | Internal Code | Scenario |
|---|---|---|
| 英伦优选贸易有限公司 | `DEMO-CN-UK-001` | Main customer for inbound, SKU, inventory, outbound, returns, billing, and tracking demos |
| Northstar Home Goods Ltd | `DEMO-UK-3PL-002` | Secondary customer for multi-customer isolation and staff view demos |

Suggested fake contact data:

- Email domains: `example.com`, `example.test`
- Phone values: use non-real placeholders such as `+44 0000 000000`
- Address values: clearly fake warehouse/customer examples
- Document names: `demo-vat-certificate.pdf`, `demo-product-photo.jpg`

## Minimum Dataset

### Customers

- 2 customers with different statuses:
  - `verified`
  - `pending_review`
- Each customer should have:
  - company name
  - contact name
  - fake phone/email
  - VAT/EORI placeholder
  - platform list, such as Amazon UK, eBay, Shopify, TikTok Shop

### SKUs

Create 6-8 SKUs across common fulfillment profiles:

| SKU Type | Example |
|---|---|
| Small parcel | phone case, accessory, light item |
| Medium parcel | home storage item, kitchen tool |
| Heavy item | 15-30kg package |
| Oversized item | large home goods item |
| Return-sensitive item | apparel or consumer electronics accessory |
| FBA prep item | cartonized Amazon shipment item |

Each SKU should include:

- Chinese product name
- English product name
- barcode/FNSKU placeholder
- weight and dimensions
- category
- declared value
- HS code placeholder
- photo placeholder name

### Inbound ASN

Add 2 inbound examples:

- A normal carton inbound with multiple SKUs.
- A pallet inbound that triggers pallet storage and putaway workflow.

Useful statuses:

- `draft`
- `submitted`
- `receiving`
- `putaway_completed`
- `exception_required`

### Inventory

Add stock balances that show realistic warehouse states:

- available quantity
- reserved quantity
- inbound quantity
- defective quantity
- location code
- warehouse code
- aging days
- alert quantity

Include at least one SKU with low-stock alert and one SKU with long-aging inventory.

### Outbound Orders

Add 4-6 outbound examples:

- standard Royal Mail small parcel
- FedEx parcel using volumetric weight logic
- UPS remote-zone example
- multi-item order
- order waiting for address correction
- warehouse handoff completed order

Each order should include:

- customer code
- recipient placeholder
- fake address
- service level
- SKU lines
- package weight/dimensions
- status
- tracking placeholder

### Returns / RMA

Add 2 return examples:

- Amazon return requiring relabeling
- buyer return requiring inspection and photo feedback

Include:

- original order reference
- return tracking placeholder
- reason
- inspection result
- suggested disposition
- relabel count
- fee events

### Billing

Add a small statement period with line items:

- inbound fee
- putaway fee
- storage fee
- outbound handling fee
- carrier fee
- relabeling fee
- value-added service fee
- adjustment or dispute example

Billing examples should reference demo workflow IDs so contributors can trace why a charge exists.

### Notifications and Todos

Add staff and customer todos:

- missing VAT/EORI document
- inbound exception requiring confirmation
- low-stock alert
- billing statement ready for review
- delivery exception requiring ops follow-up

## Seed Command Target

Future implementation should add a command such as:

```bash
npm run seed:demo
```

Expected behavior:

- Create deterministic demo records.
- Avoid real data.
- Be safe to rerun.
- Clearly print what was created.
- Support local fallback mode first.
- Add PostgreSQL support when the relevant repositories are ready.

## Reset Command Target

Future implementation may add:

```bash
npm run reset:demo
```

Expected behavior:

- Remove only demo records.
- Never touch production data.
- Refuse to run when `NODE_ENV=production`.
- Print a warning before destructive local reset work.

## Test and Screenshot Use

The same demo dataset should support:

- README screenshots.
- Playwright smoke tests.
- Contributor onboarding.
- Manual product review.
- Billing and warehouse workflow demos.

Recommended smoke-test paths:

- customer registration/login
- portal dashboard load
- inbound ASN submission
- SKU list view
- outbound order creation
- ops workbench review
- warehouse workbench task list
- billing statement review

## Open Questions

- Should demo auth use a fixed fake customer login, or should contributors create a customer through the registration flow?
- Should local fallback demo data and PostgreSQL demo data share one seed source?
- Should generated tracking IDs follow carrier-specific fake prefixes?
- Should billing demo data use a fixed monthly statement period, or generate the current month dynamically?
- Should screenshots use the same seed data as tests, or a smaller visual-only dataset?
