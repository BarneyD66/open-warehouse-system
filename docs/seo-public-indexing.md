# Public-site discovery (NEX-SEO-01)

This change targets the **nexroutehub.com marketing deployment only**. The admin
deployment and its separately managed noindex/robots policy are outside this
release. Do not deploy this marketing candidate to the admin project.

- `src/app/robots.ts` allows public crawling and blocks API, login, customer,
  warehouse, billing, and staff paths, including their nested print pages.
- `src/app/sitemap.ts` lists direct public pages, all service detail IDs from
  `serviceSections`, and all news slugs from `newsArticles` (25 URLs initially).
- `/services` redirects to `/services/warehousing`; `/contact` and `/workflow`
  redirect to the inquiry form. These redirect aliases are not sitemap entries.
- `/inquiry` is an anonymous quotation form. The marketing proxy now serves it
  directly, matching the live public site's HTTP 200 behavior. Customer/admin
  routing and authentication checks are unchanged.
- `/tracking` requires a customer session, so it is blocked and not listed.
- Public pages declare absolute self canonicals and `index,follow`. The existing
  homepage client component is preserved verbatim in `HomePage.tsx`; its route
  wrapper supplies server metadata without changing the UI.
- `public/llms.txt` repeats the description already in `src/app/layout.tsx` and
  links to public pages. It adds no company claims or operating figures.

`publicPagesLastModified` records the 2026-10-27 canonical metadata update.
Update it (or introduce per-page editorial dates) on future substantive page or
metadata edits; never replace it with the current request/build time. Re-audit
the allowlist before adding authenticated, redirected, or noindex routes.

## Local validation

Use an isolated checkout without production environment files or database
credentials. No database or external API is required for discovery routes.

```sh
npm ci --no-audit --no-fund
npm run lint
npm run build
npx tsc --noEmit
npm run start -- --hostname 127.0.0.1 --port 3107
# In another terminal:
node scripts/check-public-seo.mjs http://127.0.0.1:3107
```

The check only accepts loopback HTTP endpoints and checks all sitemap URLs for
HTTP 200, self canonicals, indexability, dates, uniqueness, and robots coverage.
It also checks discovery files and customer/admin authentication redirects.

## Factory handoff

Code push is not deployment approval. Factory must create an isolated Preview,
run B1/QA, and retain the current production deployment ID before any authorized
production release. Check the three discovery endpoints and every sitemap entry
again on Preview and after release. Preserve the admin deployment's independent
noindex policy. This task does not deploy, promote, submit IndexNow, or request
search-engine indexing.
