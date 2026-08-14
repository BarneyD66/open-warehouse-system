# Demo Personas

Use these fictional personas when reviewing Open Warehouse System locally, preparing screenshots, writing issues, or explaining the project to Codex for OSS reviewers.

These are not real accounts, real customers, or production credentials. They are safe review lenses for thinking through the product.

## Persona Rules

- Use fake names, fake emails, fake order IDs, fake SKUs, fake addresses, and fake tracking numbers.
- Do not publish real customer records, warehouse documents, provider dashboards, labels, payment proofs, logs, `.env.local`, or private pricing.
- Do not document real staff passwords or private test accounts in public issues, screenshots, or release notes.
- If a reviewer needs to sign in locally, use the safe setup path documented in `docs/DEMO_WALKTHROUGH.md` and `docs/STAFF_AUTH.md`.

## Customer Persona

Name: `Demo Customer Chen`

Role: cross-border seller or ecommerce operator.

Review focus:

- Can the customer understand the registration or login path?
- Can they find inbound ASN, SKU, outbound, returns, billing, and tracking surfaces?
- Are customer-facing examples Chinese-first when reviewing Chinese-mode workflows?
- Are exports, templates, and screenshots free of real customer data?

Suggested fake records:

- Customer ID: `DEMO-CUSTOMER-001`
- SKU: `SKU-DEMO-001`
- Inbound ASN: `ASN-DEMO-001`
- Outbound order: `OUT-DEMO-001`
- Return: `RMA-DEMO-001`
- Tracking number: `TRK-DEMO-0001`

## Ops Persona

Name: `Demo Ops Li`

Role: operations reviewer responsible for leads, customer requests, exceptions, billing, and document review.

Review focus:

- Are staff-only surfaces separated from customer-facing pages?
- Can ops review inbound, outbound, billing, return, exception, document, and todo status?
- Are staff notes, private pricing, provider dashboards, and production logs excluded from public examples?
- Is the workflow clear enough for a new contributor to file a focused issue?

## Warehouse Persona

Name: `Demo Warehouse Wang`

Role: warehouse staff member working on receiving, putaway, picking, packing, handoff, locations, and print-oriented tasks.

Review focus:

- Are warehouse workbench tasks understandable without training on a private production system?
- Are scan codes, labels, print pages, and locations represented with fake data only?
- Does mobile or handheld review reveal any unclear task action?
- Is there a small testable improvement that could become a `good first issue`?

## Maintainer Persona

Name: `Demo Maintainer`

Role: open-source maintainer reviewing contributions, safety, docs, release notes, and verification.

Review focus:

- Does the change stay small and reviewable?
- Are setup, release, deployment, migration, and data-safety assumptions documented?
- Were `git diff --check` and the relevant project checks run?
- Are unrelated local files, logs, screenshots, secrets, and generated artifacts excluded from commits?

## Regional Contributor Persona

Name: `Demo Regional Contributor`

Role: contributor proposing a new locale, carrier, address format, billing label, customs field, or privacy assumption.

Review focus:

- Does the proposal preserve Chinese-first customer workflows?
- Are regional assumptions documented before implementation?
- Are country-specific rules placed behind config, adapters, templates, or documented boundaries?
- Does the contributor use `docs/GLOBAL_READINESS_REVIEW.md`, `docs/REGIONAL_ADAPTATION_GUIDE.md`, and `docs/REGION_PROFILE_TEMPLATE.md`?

## Related Docs

- `docs/DEMO_WALKTHROUGH.md`
- `docs/DEMO_DATA_PLAN.md`
- `docs/PUBLIC_DEMO_CHECKLIST.md`
- `docs/STAFF_AUTH.md`
- `docs/GLOBAL_READINESS_REVIEW.md`
- `docs/CONTRIBUTOR_QUICK_PATH.md`
