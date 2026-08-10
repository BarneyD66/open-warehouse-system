# Global Readiness Review

Use this checklist when explaining why Open Warehouse System is global-ready without claiming that it is compliant in every country out of the box.

Global-ready means the project has clear extension points for language, region, carriers, billing, customs, privacy, and warehouse process differences. It does not mean the default repository replaces local legal, tax, customs, labor, privacy, or carrier review.

## Reviewer Summary

Open Warehouse System starts with Chinese-first cross-border warehouse workflows, but the repository is structured so contributors can adapt the same WMS foundation for other markets. The core workflows should stay stable: customer onboarding, inbound ASN, SKU and inventory, outbound fulfillment, returns/RMA, billing review, tracking, ops review, and warehouse operations.

Regional behavior should be added through configuration, adapters, documented assumptions, and reviewable pull requests rather than hard-coded one-off behavior.

## Readiness Signals

- English-readable repository docs and maintainer materials.
- Chinese-first customer workflows for the initial operator audience.
- Region adaptation docs for language, carriers, tax, customs, address formats, privacy, billing, and warehouse process assumptions.
- Translation rules that require workflow review before label-by-label translation.
- Export localization rules for CSV, Excel, printable documents, and customer-facing templates.
- Mock carrier adapter guidance before real provider credentials or production payloads are introduced.
- Public demo and secret-handling rules that reject real customer data, production labels, credentials, and private pricing material.

## Adaptation Boundaries

Before claiming support for a new country, document these boundaries:

| Area | What to verify |
| --- | --- |
| Language | UI copy, help text, validation messages, emails, notifications, and customer-facing exports |
| Address | Required fields, phone format, postal code rules, local scripts, and delivery notes |
| Carrier | Service names, label creation, tracking events, exceptions, webhooks, and credentials |
| Customs | HS code, declared value, origin country, VAT/EORI/IOSS or equivalent regional fields |
| Billing | Currency, rounding, invoice naming, tax terminology, surcharges, and statement approval rules |
| Privacy | Retention periods, export/deletion requests, staff access, audit logging, and regional hosting assumptions |
| Warehouse | Receiving, putaway, pick/pack, quality inspection, return grading, scan codes, and location naming |

## Claim Rules

Use precise public wording:

- Say `global-ready`, `region-adaptable`, or `designed for localization`.
- Say `Chinese-first` when describing the current complete customer workflow audience.
- Say `requires regional review before production use` for new markets.
- Do not say the project is universally compliant, production-certified, carrier-approved, or ready for every country's legal/tax/customs requirements by default.

## Contribution Path

For a contributor proposing a new market:

1. Fill in `docs/REGION_PROFILE_TEMPLATE.md`.
2. Review `docs/REGIONAL_ADAPTATION_GUIDE.md`.
3. Use `docs/LOCALIZATION_WORKFLOW_REVIEW_TEMPLATE.md` for the affected customer route.
4. Use `docs/EXPORT_LOCALIZATION_CHECKLIST.md` for CSV, Excel, and printable artifacts.
5. Keep real customer data, labels, credentials, payment proofs, and production screenshots out of the PR.
6. Include the smallest relevant verification commands in the PR notes.

## Related Docs

- `docs/INTERNATIONALIZATION.md`
- `docs/REGIONAL_ADAPTATION_GUIDE.md`
- `docs/REGION_PROFILE_TEMPLATE.md`
- `docs/TRANSLATION_CONTRIBUTION_GUIDE.md`
- `docs/LOCALIZATION_WORKFLOW_REVIEW_TEMPLATE.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
- `docs/MOCK_CARRIER_ADAPTER.md`
- `docs/PUBLIC_DEMO_CHECKLIST.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`
