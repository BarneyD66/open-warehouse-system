export type SurfaceName = "marketing" | "customer" | "admin";
export type RuntimeSurface = SurfaceName | "local";

const surfaceBases: Record<SurfaceName, string> = {
  marketing: process.env.NEXT_PUBLIC_MARKETING_URL ?? "",
  customer: process.env.NEXT_PUBLIC_CUSTOMER_APP_URL ?? "",
  admin: process.env.NEXT_PUBLIC_ADMIN_URL ?? "",
};

function normaliseBase(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function surfaceHref(surface: SurfaceName, path = "/") {
  const base = normaliseBase(surfaceBases[surface]);
  const normalisedPath = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalisedPath}` : normalisedPath;
}

export function currentSurface(): RuntimeSurface {
  if (typeof window !== "undefined") {
    const allowSurfaceQuery = process.env.NEXT_PUBLIC_ALLOW_SURFACE_QUERY === "true";
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (allowSurfaceQuery && isLocalHost) {
      const localSurface = new URLSearchParams(window.location.search).get("surface")?.toLowerCase();
      if (localSurface === "marketing" || localSurface === "web" || localSurface === "site") return "marketing";
      if (localSurface === "customer" || localSurface === "app" || localSurface === "portal") return "customer";
      if (localSurface === "admin" || localSurface === "ops") return "admin";
    }
  }

  const value = process.env.NEXT_PUBLIC_WAREHOUSE_SURFACE?.toLowerCase();
  if (value === "marketing" || value === "web" || value === "site") return "marketing";
  if (value === "customer" || value === "app" || value === "portal") return "customer";
  if (value === "admin" || value === "ops") return "admin";
  if (value === "local" && process.env.NODE_ENV !== "production") return "local";
  return "marketing";
}
