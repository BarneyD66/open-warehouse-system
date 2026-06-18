# Regional Adaptation Guide

This guide explains how Open Warehouse System should be adapted for different countries and regions without hard-coding one market's assumptions into the core WMS workflow.

The project is Chinese-first and global-ready. That means Chinese-speaking cross-border teams are the first complete workflow audience, while the architecture should remain understandable and extendable for other markets.

This is not legal, tax, customs, privacy, labor, or carrier compliance advice. Treat it as an engineering checklist for responsible localization and integration work.

## Adaptation Layers

Use separate layers instead of scattering region-specific logic across pages:

| Layer | Examples | Preferred extension point |
| --- | --- | --- |
| Language and copy | UI labels, errors, emails, notifications | locale files or copy config |
| Customer-facing artifacts | CSV/Excel templates, exports, sample rows, print documents | export/template presenters |
| Logistics | carriers, services, labels, tracking, delivery exceptions | carrier adapters |
| Tax and billing | VAT, GST, sales tax, invoice numbers, currency, due dates | billing config and tax adapters |
| Customs and trade | HS codes, EORI, IOSS, declared values, origin country | customs field config |
| Address handling | postcode, state/province, phone format, local scripts | address config and validation adapters |
| Privacy and retention | data export, deletion, audit retention, staff access | policy config and audit logs |

## Region Checklist

Before claiming support for a region, document these decisions:

- Default language and fallback language.
- Customer-facing export language.
- Currency and rounding rules.
- Date, time zone, and date-format expectations.
- Address format and required recipient fields.
- Local carrier services and service-level names.
- Label and tracking event assumptions.
- Tax labels, invoice fields, and billing statement terminology.
- Customs fields needed for cross-border fulfillment.
- Data retention and deletion expectations.
- Staff access and audit requirements.

## UK Example

Typical UK-focused extension points:

- Carriers: Royal Mail, DPD, Evri, DHL, UPS, Yodel.
- Address fields: postcode, county or city, recipient phone, delivery notes.
- Trade fields: VAT, EORI, HS code, declared value, country of origin.
- Billing: GBP, VAT terminology, monthly statements, carrier surcharge review.
- Workflow notes: delivery exception handling, proof of delivery, return/RMA tracking.

Use `docs/MOCK_CARRIER_ADAPTER.md` before adding real carrier credentials or provider-specific payloads.

## EU Example

Typical EU-focused extension points:

- Country-specific VAT/GST terms and invoice requirements.
- IOSS or marketplace tax fields where relevant.
- Multi-country address and phone validation.
- Carrier service names by country.
- Cross-border return routing and local delivery exceptions.
- Multi-currency billing if one warehouse serves customers across multiple markets.

Keep country-specific fields configurable. Avoid adding one-off fields directly to UI components unless the workflow has a stable domain reason.

## US Example

Typical US-focused extension points:

- State, ZIP code, phone format, and address line rules.
- Sales tax terminology and state-level tax assumptions.
- Carriers such as USPS, UPS, FedEx, and regional delivery services.
- Dimensional weight and surcharge display rules.
- Return authorization, replacement, and customer service terminology.

Do not assume UK VAT/EORI fields are meaningful in US-only customer-facing flows. Keep them optional or hidden behind region configuration.

## APAC Example

Typical APAC-focused extension points:

- Local scripts and multi-language customer names.
- Marketplace-specific order fields.
- Local courier handoff and proof-of-delivery formats.
- Region-specific phone and address rules.
- Multi-currency billing and exchange-rate notes.
- Local privacy and data residency expectations.

When a customer-facing workflow is Chinese-mode, keep customer-visible CSV/Excel templates, export headers, and sample rows Chinese-first. English field names can remain internal aliases for integrations.

## Implementation Rules

- Keep core states stable across regions: inbound, receiving, putaway, inventory, outbound, shipped, delivered, return, billing, and exception states should remain domain-level concepts.
- Put provider-specific logic behind adapters.
- Put country-specific labels and fields behind configuration.
- Keep audit logs readable by the operations team.
- Keep fake demo data clearly fake in screenshots, tests, and issue reproductions.
- Document assumptions before adding region-specific behavior.

## Review Checklist

For regional adaptation pull requests:

- Does the change preserve existing Chinese-first workflows?
- Does it keep customer-facing exports and templates language-consistent?
- Are internal English field aliases hidden from customer-facing Chinese exports?
- Are carrier credentials, production labels, payment proofs, real customer data, and `.env.local` excluded?
- Are tax, customs, privacy, and carrier assumptions documented rather than implied?
- Is there a test or manual verification note for the affected workflow?

## Related Docs

- `docs/INTERNATIONALIZATION.md`
- `docs/MOCK_CARRIER_ADAPTER.md`
- `docs/DEMO_DATA_PLAN.md`
- `docs/SCREENSHOT_GUIDE.md`
- `SECURITY.md`
