# First Issue Response Template

Use these response templates when maintainers receive a new public GitHub issue for Open Warehouse System.

The goal is to keep first-time contributor conversations useful, scoped, and safe without asking for private warehouse, customer, carrier, billing, or production details.

## Before Replying

Check the issue against:

- `docs/ISSUE_PUBLISHING_CHECKLIST.md`
- `docs/ISSUE_TRIAGE_LABELS.md`
- `docs/CONTRIBUTOR_WORKFLOW_MAP.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`

If the issue contains private data, ask the reporter to remove it before continuing. Do not quote private data back in the reply.

## Good First Issue Acknowledgement

```md
Thanks for opening this. This looks suitable for a small public contribution.

Proposed scope:
- Workflow:
- Route/API/doc:
- Data policy: fake demo records only
- Non-goal:

Suggested verification:
- git diff --check

Please keep the change narrow and avoid real customer records, production screenshots, credentials, logs, labels, invoices, or private pricing sheets.
```

## Needs Reproduction

```md
Thanks for the report. To keep this reproducible without private data, please add:

- Route or workflow:
- Expected behavior:
- Actual behavior:
- Fake example ID, such as DEMO-CUSTOMER-001 or TRK-DEMO-0001:
- Local verification command or screenshot using fake demo data:

Please do not share `.env.local`, database URLs, production screenshots, logs, carrier dashboards, customer addresses, labels, invoices, or payment proofs.
```

## Needs Scope Reduction

```md
This is useful, but the current scope is too broad for one issue.

Please split it into one workflow at a time:
- Customer access
- Inbound receiving
- SKU and inventory
- Outbound fulfillment
- Returns
- Tracking and logistics
- Billing and statements
- Warehouse execution
- Regional adaptation

For this issue, let's keep only:
- Workflow:
- Route/API/doc:
- Verification:
```

## Unsafe Data Redaction Request

```md
This issue appears to include private or production information.

Please remove any real customer data, addresses, phone numbers, tracking numbers, labels, invoices, payment proofs, logs, credentials, `.env.local`, database URLs, private pricing sheets, or provider screenshots.

After the issue is redacted, please replace examples with fictional values such as:
- DEMO-CUSTOMER-001
- SKU-DEMO-001
- OUT-DEMO-0001
- TRK-DEMO-0001
```

## Regional Claim Clarification

```md
Thanks for the regional workflow note.

Before we claim support for a country or region, please document assumptions with:
- `docs/REGION_PROFILE_TEMPLATE.md`
- `docs/REGIONAL_ADAPTATION_GUIDE.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`

This project is region-adaptable, but it does not claim universal legal, tax, customs, privacy, carrier, or labor compliance by default.
```

## Closing As Not Publicly Actionable

```md
Closing this for now because it depends on private data, production credentials, private customer files, or a broad deployment-specific workflow that public contributors cannot inspect.

A smaller public issue can be reopened if it includes:
- One workflow
- Fake demo data only
- Clear acceptance criteria
- Local verification steps
```

## Related Docs

- `docs/PUBLIC_ISSUE_QUEUE.md`
- `docs/ISSUE_PUBLISHING_CHECKLIST.md`
- `docs/FEEDBACK_TO_ISSUE_PLAYBOOK.md`
- `docs/CONTRIBUTOR_WORKFLOW_MAP.md`
- `docs/ISSUE_TRIAGE_LABELS.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`
