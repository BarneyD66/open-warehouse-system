# Secret Handling Checklist

Use this checklist before opening pull requests, publishing docs, preparing releases, or adding integrations to Open Warehouse System.

The repository is public. Secrets, production credentials, customer data, and private operational evidence must stay out of commits, issues, screenshots, release notes, and Codex-assisted prompts.

## Never Commit

Do not commit:

- `.env.local` or production `.env` files.
- Real `SESSION_SECRET` values.
- Staff usernames and passwords.
- Customer reset tokens or password reset links.
- PostgreSQL or hosted database URLs.
- Carrier account numbers, API keys, OAuth tokens, webhook secrets, or tracking payloads.
- Marketplace credentials, app secrets, refresh tokens, signed payload secrets, or sandbox-to-production credentials.
- Payment provider keys, payment proofs, invoices, bank information, or private pricing sheets.
- Production screenshots, logs, uploads, database dumps, `.local-data`, or customer documents.

## Safe Placeholder Pattern

Use obvious placeholders in public files:

```text
SESSION_SECRET=replace-with-a-long-random-secret
POSTGRES_URL=
DATABASE_URL=
STAFF_WHITELIST_JSON=
```

For provider examples, use placeholders such as:

```text
PROVIDER_API_KEY=replace-with-provider-api-key
PROVIDER_WEBHOOK_SECRET=replace-with-provider-webhook-secret
```

Do not use real-looking tokens, copied sandbox tokens, or values from screenshots.

## Before Committing

Run:

```bash
git status --short
git diff --check
```

Review staged files:

```bash
git diff --cached --name-only
git diff --cached
```

Confirm:

- Only intended files are staged.
- `.env.local`, logs, uploads, `.local-data`, and database dumps are not staged.
- New docs use fake demo data only.
- Screenshots do not show customer names, addresses, order IDs, labels, payment proofs, database URLs, or tokens.
- Integration examples use placeholder keys and fake payloads.

## Environment Files

`.env.example` may document variable names and safe defaults. It must not contain real credentials.

`.env.local` is local-only and must stay uncommitted. If a change requires a new variable:

- Add the variable name to `.env.example`.
- Use an empty value or an obvious placeholder.
- Document the purpose and whether it is required for local development.
- Avoid provider-specific production values in examples.

## Integration Work

For carrier, marketplace, payment, storage, notification, or webhook integrations:

- Start with a mock adapter or signed-gateway design.
- Keep credentials in environment variables.
- Keep provider payload examples fake and minimal.
- Do not commit production labels, tracking webhooks, payment proof files, or customer exports.
- Document sandbox setup separately from production setup.
- Add smoke or manual verification notes that do not reveal private values.

## Public Issues And PRs

Public discussion should not include:

- Exploit details for live systems.
- Production stack traces with secrets.
- Real customer records.
- Private warehouse addresses.
- Provider request/response bodies containing account IDs or tokens.
- Full `.env.local` content.

If a report requires sensitive details, follow `SECURITY.md`.

## If A Secret Is Exposed

1. Stop using the exposed value.
2. Rotate or revoke it in the provider system.
3. Remove the secret from current files.
4. Notify maintainers privately.
5. Review whether git history or release artifacts need remediation.
6. Add a public note only when it can be done without repeating the secret.

Do not rely on deleting a GitHub comment or force-pushing as the only remediation. Assume exposed secrets have been copied.

## Codex/API Use

Do not paste secrets, `.env.local`, production logs, private exports, carrier payloads, payment proofs, or customer documents into Codex/API prompts.

Use fake data and public code snippets only. See `docs/CODEX_CREDIT_USE_PLAN.md`.

## Related Docs

- `SECURITY.md`
- `SUPPORT.md`
- `docs/MAINTAINER_HANDOFF.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `docs/SMOKE_TEST_PLAN.md`
- `docs/CODEX_CREDIT_USE_PLAN.md`
