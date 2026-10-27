import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/publicSeo";
import { newsArticles } from "./news/data";
import { servicePath, serviceSections } from "./services/data";

// Update when these pages' content or canonical metadata changes; do not use
// the request/build time, which would report unrelated deploys as content edits.
const publicPagesLastModified = "2026-10-27";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only direct, anonymous public pages. /services redirects to its default
  // detail; /contact and /workflow redirect to /inquiry; /tracking needs login.
  const paths = [
    "/",
    "/about",
    "/pricing",
    "/help",
    "/advisor",
    "/inquiry",
    "/news",
    ...serviceSections.map((service) => servicePath(service.id)),
    ...newsArticles.map((article) => `/news/${article.slug}`),
  ];

  return paths.map((path) => ({
    url: new URL(path, PUBLIC_SITE_URL).href,
    lastModified: publicPagesLastModified,
  }));
}
