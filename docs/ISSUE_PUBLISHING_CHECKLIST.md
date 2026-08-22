# Issue Publishing Checklist

Use this checklist before publishing any Open Warehouse System GitHub issue from `docs/PUBLIC_ISSUE_QUEUE.md`, community feedback, roadmap review, or contributor requests.

The goal is to keep public collaboration useful, scoped, and safe for the Codex for OSS review period.

## 1. Confirm Public Safety

Do not publish the issue if it includes:

- Real customer names, addresses, emails, phone numbers, labels, tracking numbers, invoices, or payment proofs.
- `.env.local`, database URLs, API keys, session secrets, provider credentials, or staff credentials.
- Production screenshots, logs, uploads, warehouse documents, private pricing sheets, or carrier dashboards.
- Country-specific compliance claims without a region profile and review evidence.

Replace all examples with fictional IDs such as:

- `DEMO-CUSTOMER-001`
- `SKU-DEMO-001`
- `OUT-DEMO-0001`
- `TRK-DEMO-0001`

## 2. Pick One Workflow Boundary

Every public issue should name one primary workflow:

- Customer access
- Inbound receiving
- SKU and inventory
- Outbound fulfillment
- Returns
- Tracking and logistics
- Billing and statements
- Warehouse execution
- Ops system review
- Regional adaptation

Use `docs/CONTRIBUTOR_WORKFLOW_MAP.md` to choose the matching route, role, API boundary, docs, and verification path.

## 3. Keep Scope Reviewable

The issue should include:

- One user role.
- One route, API boundary, document, or test path.
- One expected outcome.
- One verification command.
- One clear non-goal.

Do not combine docs, UI, persistence, auth, billing, logistics, and regional behavior in the same starter issue.

## 4. Use Clear Labels

Recommended label groups:

- Size: `good first issue`, `help wanted`
- Type: `documentation`, `test`, `frontend`, `backend`, `developer-experience`
- Domain: `warehouse`, `inventory`, `billing`, `logistics`, `localization`, `internationalization`, `security`
- Process: `triage`, `release`, `maintenance`

Use `docs/ISSUE_TRIAGE_LABELS.md` when a label choice is unclear.

## 5. Write Acceptance Criteria

Good acceptance criteria should be concrete enough that a maintainer can review the issue without private context.

Use this shape:

```md
Acceptance criteria:
- Uses fake demo records only.
- Updates exactly one route, document, test, or workflow note.
- Links to the relevant reviewer or contributor docs.
- Documents any non-goals or regional assumptions.
- Includes verification notes.
```

## 6. Add Verification

Choose the smallest relevant verification:

| Change type | Verification |
| --- | --- |
| Documentation only | `git diff --check` |
| UI copy or route rendering | `npm run lint`, `npm run build` |
| API, auth, billing, inventory, logistics, or warehouse code | `npm run lint`, `npm run build`, route-specific smoke notes |
| PostgreSQL schema or repository work | `npm run lint`, `npm run build`, `npm run db:init` |
| Public screenshot or media work | `git diff --check`, plus `docs/PUBLIC_DEMO_CHECKLIST.md` |
| Regional adaptation | `git diff --check`, `npm run lint`, region profile notes |

## 7. Publishing Template

```md
Title: docs: document one safe outbound demo path

Workflow: outbound fulfillment
Role: warehouse staff
Route/API/doc: /warehouse and docs/DEMO_WALKTHROUGH.md
Data policy: fake records only
Non-goal: no real carrier labels, credentials, or production tracking

Summary:
Document a fake pick-pack-ship path that contributors can review locally.

Acceptance criteria:
- Use OUT-DEMO-0001 or another fictional outbound ID.
- Document the expected states from order creation to warehouse handoff.
- Link to docs/CONTRIBUTOR_WORKFLOW_MAP.md.
- Include verification notes.

Verification:
- git diff --check
```

## 8. After Publishing

- Apply labels.
- Link back to `docs/PUBLIC_ISSUE_QUEUE.md` if the issue came from the queue.
- Link related docs and prior issues.
- Use `docs/FIRST_ISSUE_RESPONSE_TEMPLATE.md` for the first maintainer reply.
- Ask contributors to clarify scope before expanding the task.
- Close or rewrite the issue if it drifts into private data, production credentials, or broad ERP replacement work.

## Related Pull Request Draft

When merging the issue publishing documentation branch, use `docs/ISSUE_PUBLISHING_PR_DRAFT.md` for the copy-ready pull request title, body, safety notes, validation summary, and pre-merge checklist.
