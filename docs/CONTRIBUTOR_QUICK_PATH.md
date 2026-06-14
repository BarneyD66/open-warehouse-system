# Contributor Quick Path

This short path is for contributors who want to make a first useful pull request without learning the whole WMS domain first.

For the full guide, see `docs/CONTRIBUTOR_ONBOARDING.md`.

## 1. Choose a Small Issue

Start with issues labeled:

- `good first issue`
- `documentation`
- `developer-experience`
- `test`
- `frontend`

Good first tasks should be small, reviewable, and safe to complete without production data.

Recommended first contribution types:

- Improve English documentation or setup notes.
- Add safe fake demo data notes.
- Clarify one customer, ops, or warehouse workflow.
- Add a Playwright smoke test for one route.
- Improve mobile layout or accessibility text.
- Improve CSV/Excel template documentation while keeping Chinese-mode customer-facing headers and examples Chinese-first.

## 2. Run the Project

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

Useful routes:

- `/login`: customer login and registration.
- `/portal`: customer portal.
- `/ops-login`: staff login.
- `/ops`: ops workbench.
- `/warehouse`: warehouse workbench.
- `/tracking`: tracking page.

For staff demo access, see `docs/STAFF_AUTH.md`.

If your local fallback data gets messy, reset it with `docs/LOCAL_DEMO_RESET.md`.

## 3. Keep the Change Narrow

Before editing, write down:

- The route or file you are changing.
- The user role affected: customer, ops, warehouse, finance, or admin.
- The expected behavior after the change.
- The verification command or manual check.

Avoid broad refactors in a first PR.

## 4. Protect Data

Do not use or commit:

- `.env.local`.
- Real customer data.
- Real warehouse addresses.
- Production screenshots.
- Database URLs.
- Carrier credentials.
- Payment proofs.
- Private pricing sheets.

Use fake customers, fake SKUs, fake order numbers, and fake tracking numbers.

## 5. Verify

For documentation-only changes:

```bash
git diff --check
```

For code changes:

```bash
npm run lint
npm run build
```

For workflow changes, also include a short manual verification note in the pull request.

## 6. Open the Pull Request

Use `.github/pull_request_template.md`.

Include:

- What changed.
- Why it matters to the warehouse workflow.
- How you verified it.
- Any risks around customer data, staff access, billing, inventory, files, or logistics.

Small pull requests are preferred. A clear one-file improvement is better than a large unclear refactor.
