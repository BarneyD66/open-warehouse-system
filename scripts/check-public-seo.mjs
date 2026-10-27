import assert from "node:assert/strict";
import { get as httpGet } from "node:http";

// Run against an isolated local `next start`, never a production database.
const base = process.argv[2] ?? "http://127.0.0.1:3107";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
assert.equal(new URL(base).protocol, "http:");
const origin = "https://nexroutehub.com";

function get(path, host = "nexroutehub.com") {
  // node:http preserves Host for the app's subdomain routing checks.
  return new Promise((resolve, reject) => {
    const request = httpGet(new URL(path, base), { headers: { host } }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("error", reject);
      response.on("end", () => resolve(new Response(Buffer.concat(chunks), {
        status: response.statusCode,
        headers: Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : value])),
      })));
    });
    request.on("error", reject);
    request.setTimeout(30_000, () => request.destroy(new Error(`Timeout: ${path}`)));
  });
}

const robotsResponse = await get("/robots.txt");
assert.equal(robotsResponse.status, 200);
assert.match(robotsResponse.headers.get("content-type"), /text\/plain/);
const robots = await robotsResponse.text();
assert.match(robots, /^User-Agent: \*$/im);
assert.match(robots, /^Allow: \/$/m);
assert.doesNotMatch(robots, /^Disallow:\s*\/\s*$/m);
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
const blocked = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((match) => match[1]);
for (const path of ["/api/", "/account", "/checkout", "/admin", "/ops", "/ops-login", "/portal", "/warehouse", "/inbound", "/outbound", "/pda", "/billing", "/workspace", "/app", "/login", "/tracking", "/supplement", "/skus", "/returns"]) {
  assert.ok(blocked.some((prefix) => path.startsWith(prefix)), `Not blocked: ${path}`);
}
console.log("PASS /robots.txt: HTTP 200; public crawling allowed; private prefixes blocked");

const sitemapResponse = await get("/sitemap.xml");
assert.equal(sitemapResponse.status, 200);
assert.match(sitemapResponse.headers.get("content-type"), /application\/xml/);
const xml = await sitemapResponse.text();
assert.match(xml, /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/g)];
assert.ok(entries.length > 0);
assert.equal(entries.length, [...xml.matchAll(/<url>/g)].length, "Every URL needs lastmod");
const locations = entries.map((entry) => entry[1]);
assert.equal(new Set(locations).size, locations.length, "Duplicate sitemap URLs");
for (const path of ["/", "/about", "/pricing", "/help", "/advisor", "/inquiry", "/news", "/services/warehousing"]) {
  assert.ok(locations.includes(new URL(path, origin).href), `Missing public page: ${path}`);
}
for (const [, loc, lastmod] of entries) {
  const url = new URL(loc);
  assert.equal(url.origin, origin);
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  assert.ok(!blocked.some((prefix) => url.pathname.startsWith(prefix)), `Private URL: ${loc}`);
  assert.ok(!["/services", "/contact", "/workflow"].includes(url.pathname), `Redirect URL: ${loc}`);
  assert.ok(Number.isFinite(Date.parse(lastmod)) && Date.parse(lastmod) <= Date.now(), `Invalid lastmod: ${loc}`);
  const response = await get(url.pathname);
  assert.equal(response.status, 200, loc);
  assert.doesNotMatch(response.headers.get("x-robots-tag") ?? "", /noindex|nofollow|none/i);
  const html = await response.text();
  const canonicals = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)];
  assert.equal(canonicals.length, 1, `Expected one canonical: ${loc}`);
  assert.equal(canonicals[0][1], loc);
  assert.match(html, /<meta name="robots" content="index, follow"\s*\/?\s*>/);
  console.log(`PASS ${url.pathname}: HTTP 200; index,follow; self canonical; lastmod=${lastmod}`);
}

const llmsResponse = await get("/llms.txt");
assert.equal(llmsResponse.status, 200);
const llms = await llmsResponse.text();
assert.ok(llms.startsWith("# 英国驿站\n"));
for (const [, link] of llms.matchAll(/\]\((https:[^)]+)\)/g)) {
  assert.ok(locations.includes(link) || link === `${origin}/sitemap.xml`, `Unknown llms link: ${link}`);
}
console.log("PASS /llms.txt: HTTP 200; all links reference public sitemap entries or the sitemap");

// The public inquiry exception must not bypass customer/staff authentication.
for (const [host, path, destination] of [
  ["nexroutehub.com", "/tracking", "/login"],
  ["nexroutehub.com", "/portal", "/login"],
  ["nexroutehub.com", "/ops", "/ops-login"],
  ["admin.nexroutehub.com", "/inquiry", "/ops-login"],
  ["app.nexroutehub.com", "/tracking", "/login"],
]) {
  const response = await get(path, host);
  assert.equal(response.status, 307, `${host}${path}`);
  assert.equal(new URL(response.headers.get("location"), base).pathname, destination);
  console.log(`PASS authentication redirect: ${host}${path} → ${destination}`);
}
console.log(`PASS public SEO: 3 discovery files and ${entries.length} indexable pages`);
