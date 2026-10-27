import type { Metadata } from "next";

export const PUBLIC_SITE_URL = "https://nexroutehub.com";

export function publicPageMetadata(path: string): Metadata {
  return {
    alternates: { canonical: new URL(path, PUBLIC_SITE_URL).href },
    robots: { index: true, follow: true },
  };
}
