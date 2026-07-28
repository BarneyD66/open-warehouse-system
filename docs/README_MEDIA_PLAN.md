# README Media Plan

This plan defines the recommended public screenshot set for `README.en.md` and related Codex for OSS application materials.

It does not require screenshots to be captured immediately. Use it as the review target before adding media to the repository.

## Goals

- Show that Open Warehouse System is a working WMS starter, not only documentation.
- Keep README media focused on real product workflows.
- Make screenshot capture repeatable for maintainers and contributors.
- Avoid publishing real customer data, credentials, logs, private pricing, payment proofs, or provider dashboards.
- Keep Chinese-first customer-facing workflows visible while keeping English maintainer notes readable.

## Recommended README Slots

Use no more than four product screenshots in the README unless a release specifically needs more.

| Slot | Route | Filename | Purpose |
| --- | --- | --- | --- |
| Customer portal | `/portal` | `public/screenshots/customer-portal.png` | Shows customer self-service entry points for inbound, SKU, outbound, returns, billing, and files. |
| Ops workbench | `/ops` | `public/screenshots/ops-workbench.png` | Shows staff review queues, exceptions, leads, billing, and operational follow-up. |
| Warehouse workbench | `/warehouse` | `public/screenshots/warehouse-workbench.png` | Shows receiving, picking, packing, handoff, location, and print-oriented workflow surfaces. |
| Tracking or billing | `/tracking` or `/billing` | `public/screenshots/tracking-or-billing.png` | Shows a public or customer-facing status flow with fake records. |

Optional later slots:

- `public/screenshots/mobile-warehouse.png` for a mobile warehouse viewport.
- `public/screenshots/demo-walkthrough.png` for a composed walkthrough image.
- `public/screenshots/postgres-setup.png` only if terminal output hides all secrets and connection strings.

## Alt Text And Captions

Use alt text that explains the workflow, not decorative mood.

Recommended examples:

```markdown
![Customer portal showing fake inbound, outbound, billing, and document workflow entries](public/screenshots/customer-portal.png)

![Ops workbench showing fake leads, warehouse tasks, billing review, and exception queues](public/screenshots/ops-workbench.png)

![Warehouse workbench showing fake receiving, picking, packing, and handoff tasks](public/screenshots/warehouse-workbench.png)
```

Caption style:

- Short.
- Workflow-specific.
- Honest about fake demo data.
- No claims about production, legal, customs, carrier, tax, privacy, or labor compliance.

## Capture Rules

Before capture:

- Follow `docs/DEMO_WALKTHROUGH.md`.
- Use fake demo records only.
- Close personal browser tabs, bookmarks, chats, notifications, and provider dashboards.
- Confirm `.env.local`, logs, local uploads, database dumps, and production URLs are not visible.
- Use a documented data mode: local fallback or PostgreSQL.

Recommended viewports:

- Desktop: `1440 x 900`.
- Mobile: `390 x 844`.

After capture:

- Confirm text is readable at normal GitHub README width.
- Confirm no blank screen, console error overlay, loading-only state, or broken image is visible.
- Confirm no customer, payment, credential, provider, or private pricing data is visible.
- Compress large PNG files or use WebP when appropriate.
- Add the file only after deciding where the README will reference it.

## Placement In README

Recommended structure:

1. Keep the current hero/product preview near the top.
2. Add a compact "Product Surfaces" section after the system map or before documentation.
3. Use three screenshots first: customer portal, ops workbench, warehouse workbench.
4. Link to `docs/DEMO_WALKTHROUGH.md` for the full route-by-route path.

Avoid turning the README into a gallery. Screenshots should prove product workflow coverage, not decorate the page.

## PR Checklist For README Media

When adding or replacing README screenshots:

- List every screenshot file path.
- State route, viewport, data mode, and fake data source.
- Confirm `docs/PUBLIC_DEMO_CHECKLIST.md` was followed.
- Confirm Chinese-mode customer-facing exports and sample rows remain Chinese-first if exports appear.
- Run `git diff --check`.
- Run `npm run lint`.
- Run `npm run build` if the screenshots depend on changed app behavior.

## Related Docs

- `docs/SCREENSHOT_GUIDE.md`
- `docs/PUBLIC_DEMO_CHECKLIST.md`
- `docs/DEMO_WALKTHROUGH.md`
- `docs/DEMO_DATA_PLAN.md`
- `docs/DEMO_SEED_DATA_GUIDE.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
