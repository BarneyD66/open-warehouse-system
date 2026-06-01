# Internationalization and Regional Adaptation

Open Warehouse System is Chinese-first, but it is designed to be adapted for cross-border warehouse and 3PL teams in different markets.

This document clarifies what "global-ready" means in this repository. It is intended for contributors, early adopters, and reviewers who want to understand how the project can support users outside one local market without making unrealistic compliance claims.

## Positioning

- Chinese-first: the first complete business flows are written for Chinese-speaking cross-border sellers and warehouse operators.
- English-readable: source code, repository docs, and maintainer-facing materials should remain understandable to global contributors.
- Region-adaptable: teams should be able to extend the system for local language, carriers, tax fields, customs fields, privacy requirements, billing practices, and warehouse processes.
- Not compliance-by-default: the project does not claim out-of-the-box legal, tax, customs, privacy, labor, or carrier compliance in every country.

## What Should Be Localized

Customer-visible surfaces should be localizable as a complete workflow, not just as isolated labels:

- Marketing pages and help content.
- Customer registration, login, profile, and support flows.
- Inbound ASN, SKU, outbound, returns, billing, and tracking pages.
- CSV/Excel templates, import examples, and exported headers.
- Email, notification, and message templates.
- Error messages and validation feedback.
- Print templates, labels, packing slips, and operational handoff notes.

For Chinese mode, customer-facing templates and examples should stay Chinese-first. Internal English field aliases are acceptable when they make integrations easier, but exports should not expose English-only headers to Chinese customers.

## What Should Be Region-specific

The following areas should be implemented through configuration or adapter boundaries rather than hard-coded assumptions:

- Carrier integrations: label creation, rate quotes, tracking sync, webhook ingestion, delivery exceptions.
- Customs and trade fields: HS codes, EORI/VAT fields, IOSS, declared values, country-of-origin, restricted goods notes.
- Tax and billing: VAT/GST/sales tax labels, currency, invoice numbering, due dates, statement approval rules.
- Address formats: province/state, postal code, recipient phone formats, local character sets, validation rules.
- Privacy and data retention: customer data export, deletion, audit logs, retention windows, staff access policies.
- Warehouse operations: scan codes, location naming, pick/pack rules, quality inspection steps, return grading.

## Suggested Extension Pattern

Use explicit boundaries for region-specific behavior:

1. Keep core workflow state stable: customer, SKU, inventory, inbound, outbound, return, billing, and tracking records should remain consistent across regions.
2. Add adapters for external services: carriers, payment providers, object storage, notification channels, and tax/customs services should be isolated behind interfaces.
3. Store market-specific labels and fields in configuration: avoid scattering country-specific copy or field names across UI components.
4. Preserve auditability: regional automations should write clear audit events so ops teams can review what changed and why.
5. Document assumptions: if a workflow is written for one country or carrier, state that in the docs and issues.

## Contribution Ideas

Good first contributions for global readiness:

- Add an English setup walkthrough with screenshots.
- Add sample CSV templates for one non-Chinese locale.
- Add a carrier adapter interface and mock carrier implementation.
- Document address-format differences for UK, EU, US, and APAC examples.
- Add locale-aware currency and date formatting helpers.
- Add Playwright smoke tests for language switching or translated customer flows.
- Add deployment notes for teams outside the initial China-to-UK fulfillment scenario.

## Review Checklist

Before merging internationalization-related changes, reviewers should check:

- Does the change keep Chinese-first flows intact?
- Are English docs and code comments clear enough for global contributors?
- Are country-specific rules isolated behind config, adapters, or documented assumptions?
- Do customer-facing exports and templates match the selected language?
- Are secrets, real customer data, production addresses, and payment proofs excluded?
- Is there a test or manual verification note for the affected workflow?
