# Public Demo Checklist

Use this checklist before publishing screenshots, demo videos, README images, release assets, issue media, or Codex for OSS application materials.

The goal is to show that Open Warehouse System is a working WMS starter without exposing real customer data, production credentials, carrier payloads, payment evidence, or private warehouse operations.

## Demo Scope

Define the demo before capturing anything:

- Audience:
- Workflow shown:
- Routes:
- Data mode: local fallback / PostgreSQL / static docs
- Fake customer used:
- Fake staff mode used:
- Screenshots or video:
- Public destination: README / release notes / GitHub issue / application material / docs

Keep each public demo focused on one workflow. Good candidates:

- Customer registration and portal entry.
- Inbound ASN submission.
- SKU and inventory overview.
- Ops workbench review.
- Warehouse receiving, picking, packing, or handoff.
- Tracking lookup.
- Billing statement review.
- Return/RMA inspection.

## Required Safety Checks

Before publishing, confirm:

- No real customer names, addresses, phone numbers, emails, order IDs, labels, or documents.
- No payment proofs, invoices, bank information, or private pricing sheets.
- No carrier account IDs, API keys, OAuth tokens, webhook secrets, production labels, or tracking payloads.
- No `.env.local`, environment variables, database URLs, logs, uploads, `.local-data`, or database dumps.
- No browser bookmarks, personal accounts, extensions, notifications, chat apps, or private tabs are visible.
- No production domain, admin console, cloud dashboard, or provider dashboard is visible unless it is intentionally public.
- All demo records are visibly fake and repeatable.

Use `docs/SECRET_HANDLING_CHECKLIST.md` if the demo touches integrations, credentials, or environment variables.

## Customer-facing Language

For Chinese-mode workflows:

- Customer-facing page copy remains Chinese-first.
- CSV/Excel templates use Chinese headers.
- Sample rows use Chinese customer-facing examples.
- Internal English aliases do not appear as the only customer-facing labels.
- Printable docs, labels, and reports do not imply English-only output for Chinese customers.

Use `docs/EXPORT_LOCALIZATION_CHECKLIST.md` for exports, templates, and printable artifacts.

## Visual Quality Checks

Before publishing media:

- Text is readable at normal zoom.
- The viewport is intentional and documented.
- No major UI overlap, clipped text, blank screen, console error overlay, or loading state is visible.
- The media shows an actual product workflow, not only decorative UI.
- File size is reasonable for GitHub.
- File name is stable and descriptive.

Recommended viewport checks:

- Desktop: `1440 x 900`.
- Mobile: `390 x 844`.

## Demo Notes Template

```markdown
## Public Demo Notes

- Workflow:
- Routes:
- Data mode:
- Fake data source:
- Viewports:
- Media files:
- Secret check complete:
- Customer-facing language check complete:
- Verification commands:
```

## Verification

Run the smallest relevant checks:

```bash
git diff --check
npm run lint
```

If demo media depends on app behavior:

```bash
npm run build
```

If demo media depends on PostgreSQL:

```bash
docker compose up -d postgres
npm run db:init
```

## Reject Criteria

Do not publish the demo if it:

- Contains private or production data.
- Requires real credentials to understand.
- Shows a misleading compliance claim.
- Shows broken workflow state without explaining it as a bug.
- Uses English-only customer exports for a Chinese-mode flow.
- Depends on private context that contributors cannot reproduce.

## Related Docs

- `docs/SCREENSHOT_GUIDE.md`
- `docs/README_MEDIA_PLAN.md`
- `docs/DEMO_WALKTHROUGH.md`
- `docs/DEMO_DATA_PLAN.md`
- `docs/DEMO_SEED_DATA_GUIDE.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
- `docs/SMOKE_TEST_PLAN.md`
- `SECURITY.md`
