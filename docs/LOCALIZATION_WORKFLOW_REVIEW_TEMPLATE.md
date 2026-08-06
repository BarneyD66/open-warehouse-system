# Localization Workflow Review Template

Use this template when reviewing one customer-facing workflow for localization readiness.

The goal is to map all customer-visible language and artifacts for one route or workflow before proposing translations. This keeps translated pages, validation messages, exports, screenshots, and handoff documents consistent.

Do not include real customer data, production screenshots, private pricing sheets, carrier documents, payment proofs, logs, uploads, production URLs, database URLs, or `.env.local`.

## Workflow Summary

- Route or workflow:
- Current primary language:
- Proposed target locale, if any:
- Reviewer:
- Date:
- Data used: fake demo data only

## Customer-visible Surfaces

List every customer-visible surface that belongs to this workflow.

| Surface | Location | Current language | Needs translation? | Notes |
| --- | --- | --- | --- | --- |
| Page title and navigation |  |  |  |  |
| Form labels and helper text |  |  |  |  |
| Validation messages |  |  |  |  |
| Empty states |  |  |  |  |
| Status labels |  |  |  |  |
| Notifications or email copy |  |  |  |  |
| Printable notes or handoff text |  |  |  |  |
| Screenshot or demo captions |  |  |  |  |

## Export And Template Review

Check downloadable and uploadable artifacts together with the page copy.

| Artifact | Customer-facing headers | Sample rows | Current language | Notes |
| --- | --- | --- | --- | --- |
| CSV export |  |  |  |  |
| Excel template |  |  |  |  |
| Import example |  |  |  |  |
| Print document |  |  |  |  |

For Chinese mode, customer-facing headers and sample rows should stay Chinese-first. English names should be treated as internal aliases unless the pull request proposes a complete alternate locale.

## Regional Assumptions

State assumptions instead of implying compliance.

- Address format:
- Phone format:
- Currency and rounding:
- Date and time zone:
- Carrier names or service levels:
- Tax, customs, privacy, labor, or compliance assumptions:

## Safety Check

Confirm all statements before opening a pull request:

- Fake customer names and order IDs are used.
- No real warehouse addresses are included.
- No production carrier labels, credentials, tracking payloads, or webhook examples are included.
- No payment proofs, invoices, private pricing sheets, logs, uploads, or production documents are included.
- No `.env.local`, production URLs, or database URLs are referenced.
- Screenshots, if any, follow `docs/SCREENSHOT_GUIDE.md`.

## Pull Request Notes

Copy this into the pull request:

```markdown
## Localization workflow review

- Workflow:
- Target locale:
- Customer-visible surfaces reviewed:
- Export/template artifacts reviewed:
- Fake data used:
- Regional assumptions:
- Local commands:
- Public data safety:
```

## Verification

For docs-only work:

```bash
git diff --check
```

If code, route config, locale files, or templates change:

```bash
npm run lint
```

## Related Docs

- `docs/TRANSLATION_CONTRIBUTION_GUIDE.md`
- `docs/INTERNATIONALIZATION.md`
- `docs/REGIONAL_ADAPTATION_GUIDE.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
- `docs/SCREENSHOT_GUIDE.md`
- `docs/ISSUE_TRIAGE_LABELS.md`
