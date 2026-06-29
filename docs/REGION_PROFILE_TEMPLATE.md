# Region Profile Template

Use this template when proposing support for a new country, market, carrier group, or regional warehouse workflow.

The goal is to document assumptions before implementation. A region profile is not a legal, tax, customs, privacy, labor, or carrier compliance claim. It is an engineering input for localization, adapters, exports, billing, and workflow review.

## Region Summary

- Region name:
- Primary users:
- Warehouse location assumptions:
- Seller/customer location assumptions:
- Default language:
- Fallback language:
- Currency:
- Time zone:
- Date format:
- Measurement units:

## Customer-facing Language

- Customer portal language:
- Ops copy visible to customers:
- Email or notification language:
- Printable document language:
- CSV/Excel template language:
- CSV/Excel export language:
- Sample row language:

For Chinese-mode workflows, customer-facing pages, templates, export headers, and sample rows should remain Chinese-first. Internal English aliases may exist for parsing, APIs, databases, or integrations, but should not replace customer-facing labels.

## Address And Contact Format

- Required recipient fields:
- Optional recipient fields:
- Postal code format:
- State/province/county fields:
- Phone number format:
- Local script or character-set requirements:
- Address validation assumptions:
- Delivery instruction expectations:

## Carrier And Tracking Assumptions

- Common carriers:
- Service-level names:
- Label format assumptions:
- Tracking event names:
- Delivery exception types:
- Proof-of-delivery expectations:
- Return label expectations:
- Webhook or polling assumptions:

Do not include real carrier credentials, production labels, account numbers, webhook secrets, or tracking payloads.

## Tax, Customs, And Billing Fields

- Tax terminology:
- Invoice or statement terminology:
- Currency and rounding rules:
- Billing period expectations:
- VAT/GST/sales tax assumptions:
- EORI/IOSS or local equivalent fields:
- HS code requirements:
- Declared value requirements:
- Country-of-origin requirements:
- Marketplace tax assumptions:

Mark fields as required, optional, hidden, or configuration-dependent.

## Warehouse Workflow Notes

- Receiving differences:
- Putaway/location naming:
- Pick/pack rules:
- Scanning code assumptions:
- Label or print requirements:
- Return/RMA grading:
- Quality inspection expectations:
- Exception review workflow:

Keep core states stable where possible: inbound, receiving, putaway, inventory, outbound, shipped, delivered, return, billing, and exception.

## Privacy And Retention

- Customer data retention assumption:
- Document retention assumption:
- Audit log retention assumption:
- Staff access review expectation:
- Data export or deletion expectation:
- Local privacy caveats:

Do not present this section as legal advice. Use it to identify configuration and documentation needs.

## Export And Template Review

- Templates affected:
- Export files affected:
- Customer-facing headers:
- Internal aliases:
- Sample rows:
- Printable documents:
- Fake demo data needed:

Review exports with `docs/EXPORT_LOCALIZATION_CHECKLIST.md`.

## Implementation Plan

- Config files or copy files:
- UI routes affected:
- API routes affected:
- Database fields or migrations:
- Carrier adapters:
- Billing adapters:
- Test or smoke paths:
- Documentation updates:
- Migration or rollback notes:

Prefer small pull requests. Split broad region support into docs, config, UI copy, export templates, adapters, tests, and migration work.

## Verification

- `git diff --check`:
- `npm run lint`:
- `npm run build` if behavior changed:
- Manual routes checked:
- Export/template files checked:
- Fake data confirmed:
- No secrets or production data confirmed:

## Related Docs

- `docs/REGIONAL_ADAPTATION_GUIDE.md`
- `docs/INTERNATIONALIZATION.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
- `docs/MOCK_CARRIER_ADAPTER.md`
- `docs/SMOKE_TEST_PLAN.md`
- `SECURITY.md`
