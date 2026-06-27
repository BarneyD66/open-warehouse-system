# Export Localization Checklist

This checklist helps contributors review CSV, Excel, template, and printable export changes without weakening the Chinese-first customer experience.

Open Warehouse System is global-ready, but Chinese-mode customer-facing artifacts must remain Chinese-first unless a pull request explicitly adds a separate locale or region configuration.

## Affected Artifact Types

Use this checklist when changing:

- CSV exports.
- Excel exports.
- Import templates.
- Sample rows.
- Billing statements.
- SKU templates.
- Inbound ASN templates.
- Outbound order templates.
- Return/RMA templates.
- Pick lists, packing slips, labels, and print pages.
- Customer-facing report downloads.

## Required Review

For each changed artifact, confirm:

- The selected customer-facing language matches the downloaded file.
- Chinese-mode headers remain Chinese-first.
- Chinese-mode sample rows remain Chinese-first.
- English field names are kept as internal aliases or mapping keys, not exposed as the only customer-facing headers.
- Required fields, optional fields, and example values are clear to the customer.
- Date, currency, weight, dimension, and address formats are documented when they are region-specific.
- File names do not include real customer names, production order IDs, carrier account IDs, or private warehouse identifiers.
- Demo examples use visibly fake SKUs, fake tracking numbers, fake addresses, and fake customer references.

## Internal Aliases

Internal English aliases are acceptable when they support:

- Stable import parsing.
- API payload compatibility.
- Database column mapping.
- Integration with carriers, marketplaces, or billing tools.
- Contributor readability.

They should be hidden behind import/export mapping, presenter, or adapter code when the customer-facing artifact is Chinese-mode.

## Regional Export Questions

Before claiming a new locale or region is supported, answer:

- What is the default export language?
- What is the fallback language?
- Which currency and rounding rules are used?
- Which date and time zone format is used?
- Which address fields are required?
- Which tax, customs, VAT/GST, EORI, IOSS, or declared-value fields are included?
- Which carrier service names are region-specific?
- Which fields are customer-facing labels and which are internal aliases?

Document assumptions in `docs/REGIONAL_ADAPTATION_GUIDE.md` or a region-specific guide before broadening the claim.

## Smoke Checks

For export or template changes:

- Run `git diff --check`.
- Run `npm run lint` when code changed.
- Download or generate the changed artifact locally when practical.
- Open the file and inspect headers plus sample rows.
- Confirm no `.env.local`, logs, production screenshots, payment proofs, private pricing sheets, or real customer data are referenced.
- Add a pull request note describing the customer-facing language, internal aliases, and fake data used.

## Pull Request Note Template

```markdown
## Export Localization

- Artifact:
- Customer-facing language:
- Headers checked:
- Sample rows checked:
- Internal aliases hidden:
- Region-specific assumptions:
- Fake data confirmed:
```

## Related Docs

- `docs/INTERNATIONALIZATION.md`
- `docs/REGIONAL_ADAPTATION_GUIDE.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `docs/SMOKE_TEST_PLAN.md`
- `docs/DEMO_SEED_DATA_GUIDE.md`
- `SECURITY.md`
