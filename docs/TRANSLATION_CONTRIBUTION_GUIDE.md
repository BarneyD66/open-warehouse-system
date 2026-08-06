# Translation Contribution Guide

This guide explains how contributors should propose translations, locale copy, and regional wording for Open Warehouse System.

The project is Chinese-first and global-ready. That means customer-facing Chinese workflows must remain complete and natural, while repository docs and maintainer-facing materials should stay clear enough for global contributors.

## Contribution Scope

Good translation contributions include:

- English documentation improvements.
- Locale-specific customer-facing copy proposals.
- CSV, Excel, template, export, print, and email wording improvements.
- Region profile notes that explain language, carrier, tax, customs, privacy, billing, or address assumptions.
- Translation review checklists for customer, ops, warehouse, tracking, billing, returns, and logistics workflows.

Avoid translation-only pull requests that also change business logic, auth, billing, inventory, carrier integration, database schema, or file access behavior. Keep those changes separate.

## Workflow-level Translation

Translate complete workflows instead of isolated labels.

For example, an outbound fulfillment translation should review:

- Page title and navigation label.
- Form labels and helper text.
- Validation messages.
- Empty states.
- CSV or Excel import/export headers.
- Printable handoff notes.
- Notification or email copy, if present.
- Screenshot and demo captions, if used in public docs.

This prevents a page from looking translated while exports, errors, or handoff artifacts still expose the wrong language to customers.

## Chinese-first Rules

For Chinese-mode customer workflows:

- Keep customer-visible copy natural in Chinese.
- Keep CSV, Excel, template, export, and printable headers Chinese-first.
- Use English field names only as internal aliases when they help integrations or developer readability.
- Do not replace working Chinese business terms with literal English translations.
- Do not remove Chinese examples unless the pull request explicitly adds a complete alternate locale.

## Global-ready Rules

For non-Chinese locale proposals:

- State the target locale or region.
- Document fallback language behavior.
- Explain address, phone, currency, date, and time-zone assumptions.
- Keep tax, customs, privacy, labor, and carrier claims as assumptions that need local review.
- Prefer config, templates, adapters, or locale files over hard-coded regional copy.
- Include fake demo data only.

Use `docs/REGION_PROFILE_TEMPLATE.md` when proposing a new regional workflow.

Use `docs/LOCALIZATION_WORKFLOW_REVIEW_TEMPLATE.md` when reviewing one existing customer workflow before translation work starts.

## Public Data Safety

Translation examples, screenshots, fixtures, and issue reproductions must not include:

- Real customer names or contact details.
- Real warehouse addresses.
- Production carrier labels, tracking credentials, or webhook payloads.
- Payment proofs, invoices, or private pricing sheets.
- Production URLs, database URLs, `.env.local`, logs, uploads, or exported customer files.

Use fake demo names, synthetic order IDs, and clearly fictional addresses.

## Pull Request Checklist

Before opening a translation or localization pull request, include:

- Target language, locale, or region.
- Affected workflow surface.
- Customer-visible artifacts checked.
- Fake data used.
- Commands run, usually `git diff --check` and `npm run lint`.
- Any region-specific assumptions.
- Confirmation that no real customer data, secrets, logs, production screenshots, or private documents are included.

Template:

```markdown
## Translation or localization

- Target language or locale:
- Affected workflow:
- Customer-visible artifacts checked:
- Fake data:
- Local commands:
- Regional assumptions:
- Public data safety:
```

## Related Docs

- `docs/INTERNATIONALIZATION.md`
- `docs/REGIONAL_ADAPTATION_GUIDE.md`
- `docs/REGION_PROFILE_TEMPLATE.md`
- `docs/LOCALIZATION_WORKFLOW_REVIEW_TEMPLATE.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
- `docs/SCREENSHOT_GUIDE.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `SECURITY.md`
