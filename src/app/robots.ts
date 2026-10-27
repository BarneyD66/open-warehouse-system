import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/publicSeo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/account",
        "/checkout",
        "/admin",
        "/ops",
        "/ops-login",
        "/portal",
        "/warehouse",
        "/inbound",
        "/outbound",
        "/pda",
        "/billing",
        "/workspace",
        "/app",
        "/login",
        "/tracking",
        "/supplement",
        "/skus",
        "/returns",
      ],
    },
    sitemap: `${PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
