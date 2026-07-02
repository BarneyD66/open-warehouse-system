# Screenshot and Demo Media Guide

This guide defines how Open Warehouse System should create screenshots, short demos, and visual assets for README, release notes, issues, and the Codex for OSS application.

Screenshots are useful only when they are safe, repeatable, and tied to real product workflows. Do not use production customer data or private operational screenshots.

Before publishing public demo media, also use `docs/PUBLIC_DEMO_CHECKLIST.md`.

## Goals

- Show the project is a working warehouse system, not only a code skeleton.
- Help new contributors understand the main surfaces quickly.
- Support README, release notes, issue comments, and application materials.
- Keep demo media safe for public GitHub.
- Preserve Chinese-first customer-facing workflows while keeping English maintainer notes readable.

## Required Safety Rules

Use only fake demo data:

- Fake customer names.
- Fake contacts, phone numbers, and emails.
- Fake warehouse addresses.
- Fake SKU codes and product photos.
- Fake tracking numbers.
- Fake billing records and payment references.
- Fake document names.

Never publish:

- Real customer data.
- Production warehouse addresses.
- Production carrier labels or account numbers.
- Payment proofs, invoices, or bank details.
- API keys, tokens, session values, or environment variables.
- Internal chat screenshots.
- Real pricing sheets or confidential commercial terms.

If a screenshot comes from a local development database, verify the seed source is documented in `docs/DEMO_DATA_PLAN.md`.

## Recommended Screenshot Set

Use this minimum public screenshot set:

| Surface | Route | What to Show | Notes |
|---|---|---|---|
| Marketing homepage | `/` | service positioning and inquiry entry | Use public copy only |
| Customer login | `/login` | registration/login entry | No real credentials |
| Customer portal | `/portal` | dashboard, inbound/outbound/billing navigation | Use fake customer |
| Ops workbench | `/ops` | lead, inbound, outbound, billing, exception overview | Use fake staff/session |
| Warehouse workbench | `/warehouse` | receiving, picking, packing, handoff tasks | Use fake warehouse tasks |
| Tracking | `/tracking` | shipment tracking state | Use fake tracking ID |

Optional later screenshots:

- Local PostgreSQL setup or terminal output.
- Billing statement review.
- Return/RMA inspection.
- Carrier/logistics rule panel.
- Mobile warehouse viewport.

## Suggested File Naming

Use stable, descriptive names:

```text
public/screenshots/homepage.png
public/screenshots/customer-portal.png
public/screenshots/ops-workbench.png
public/screenshots/warehouse-workbench.png
public/screenshots/tracking.png
```

For issue-specific images:

```text
docs/assets/issues/issue-0007-warehouse-mobile-before.png
docs/assets/issues/issue-0007-warehouse-mobile-after.png
```

Do not store large raw recordings in the repository. Prefer optimized PNG or WebP images.

## Capture Checklist

Before capturing:

- Run the app locally.
- Use deterministic fake demo data.
- Confirm `.env.local` and secrets are not visible.
- Confirm browser profile is not showing personal bookmarks, extensions, notifications, or logged-in third-party accounts.
- Set viewport intentionally:
  - Desktop: `1440 x 900`
  - Mobile: `390 x 844`
- Use consistent zoom at 100%.

After capturing:

- Check text is readable.
- Check no real data is visible.
- Check no overlapping UI or clipped text.
- Compress large images before committing.
- Reference the screenshot from README or release notes only when it explains a workflow.

## Public README Placement

Do not overload the README with many large images. A good public layout is:

1. One hero/product preview near the top.
2. One compact "Product surfaces" section with 3-4 screenshots.
3. Links to docs for deeper workflow details.

Recommended README screenshot order:

- Customer portal.
- Ops workbench.
- Warehouse workbench.
- Tracking or billing.

## Demo Video Guidance

Short videos are optional. If used:

- Keep public demos under 90 seconds.
- Use fake demo data only.
- Show one workflow end-to-end, not every feature.
- Avoid background music, personal desktop notifications, browser history, or private tabs.
- Prefer a scripted path:
  1. Customer submits/registers.
  2. Ops reviews.
  3. Warehouse processes.
  4. Billing/tracking updates.

Store video links outside the repository unless the file is small and intentionally public.

## Issue and PR Media

For UI issues and PRs, include:

- Before screenshot.
- After screenshot.
- Viewport size.
- Route.
- Browser.
- Verification notes.

For bugs involving private data, reproduce with fake data before attaching media.

## Review Criteria

Maintainers should reject or request changes for media that:

- Contains real customer or operational data.
- Shows production secrets or private infrastructure.
- Uses English-only customer-facing exports in Chinese-mode workflows.
- Is too large for the repository.
- Shows a broken, unreadable, or misleading workflow state.
- Is decorative but does not clarify the product or workflow.

## Future Automation Target

A future screenshot task can use Playwright to:

- Start the app.
- Load deterministic demo data.
- Capture desktop and mobile screenshots.
- Save optimized images under `public/screenshots/`.
- Fail if screenshots are blank or contain obvious error pages.

This should be implemented after the demo seed data plan is stable.
