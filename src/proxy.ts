import { NextRequest, NextResponse } from "next/server";

type Surface = "marketing" | "customer" | "admin";

const publicAssetPattern = /\.(.*)$/;
const customerPrefixes = ["/login", "/portal", "/workspace", "/tiktok-workspace", "/account", "/inquiry", "/inbound", "/tracking", "/supplement", "/billing", "/skus", "/outbound", "/returns"];
const protectedCustomerPrefixes = ["/portal", "/workspace", "/tiktok-workspace", "/account", "/inbound", "/tracking", "/supplement", "/billing", "/skus", "/outbound", "/returns"];
const adminPrefixes = ["/boss"];
const legacyAdminPrefixes = ["/admin", "/ops", "/warehouse", "/pda"];
const adminLoginPrefixes = ["/ops-login"];
const marketingPrefixes = ["/", "/advisor", "/services", "/workflow", "/pricing", "/help", "/contact"];
const publicCustomerGuidePrefixes = ["/help/packaging-materials", "/help/workbench-guide"];
const customerHomePath = "/workspace";
const adminHomePath = "/boss";

function normaliseSurface(value?: string): Surface | undefined {
  if (!value) return undefined;
  const normalised = value.toLowerCase();
  if (normalised === "web" || normalised === "site" || normalised === "marketing") return "marketing";
  if (normalised === "app" || normalised === "portal" || normalised === "customer") return "customer";
  if (normalised === "admin" || normalised === "ops") return "admin";
  return undefined;
}

function surfaceFromHost(host: string): Surface | undefined {
  const hostname = host.split(":")[0].toLowerCase();

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost")) {
    return undefined;
  }

  if (hostname.startsWith("admin.") || hostname.includes("-admin.")) return "admin";
  if (hostname.startsWith("app.") || hostname.startsWith("portal.") || hostname.startsWith("customer.") || hostname.includes("-app.")) return "customer";
  if (hostname.startsWith("www.") || hostname.includes("-web.")) return "marketing";

  return normaliseSurface(process.env.WAREHOUSE_SURFACE) ?? "marketing";
}

function surfaceFromRequest(request: NextRequest): Surface | undefined {
  return normaliseSurface(process.env.WAREHOUSE_SURFACE) ?? surfaceFromHost(request.headers.get("host") ?? "");
}

function isInternalPath(pathname: string) {
  return pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname === "/favicon.ico" || publicAssetPattern.test(pathname);
}

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || (prefix !== "/" && pathname.startsWith(`${prefix}/`)));
}

function legacyAdminDestination(pathname: string) {
  return pathname === "/pda" || pathname.startsWith("/pda/") || pathname.includes("pda") ? "/boss/pda" : adminHomePath;
}

function targetUrl(request: NextRequest, surface: Surface, path: string) {
  const hostname = request.headers.get("host")?.split(":")[0].toLowerCase() ?? "";
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost")) {
    return new URL(path, request.url);
  }

  const envUrl =
    surface === "admin"
      ? process.env.NEXT_PUBLIC_ADMIN_URL
      : surface === "customer"
        ? process.env.NEXT_PUBLIC_CUSTOMER_APP_URL
        : process.env.NEXT_PUBLIC_MARKETING_URL;

  if (envUrl) return new URL(path, envUrl);
  return new URL(path, request.url);
}

function hasSurfaceUrl(surface: Surface) {
  if (surface === "admin") return Boolean(process.env.NEXT_PUBLIC_ADMIN_URL);
  if (surface === "customer") return Boolean(process.env.NEXT_PUBLIC_CUSTOMER_APP_URL);
  return Boolean(process.env.NEXT_PUBLIC_MARKETING_URL);
}

function redirectTo(request: NextRequest, surface: Surface, path: string) {
  const target = targetUrl(request, surface, path);
  if (target.href === request.nextUrl.href) return NextResponse.next();
  return NextResponse.redirect(target);
}

function parseSignedSessionPayload<T>(value: string): Partial<T> | null {
  const [version, payload, signature] = value.split(".");
  if (version !== "v1" || !payload || !signature) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Partial<T>;
  } catch {
    return null;
  }
}

function hasCustomerSession(request: NextRequest) {
  const value = request.cookies.get("uk-warehouse-session")?.value;
  if (!value) return false;

  const decoded = parseSignedSessionPayload<{ customerCode: string; username: string }>(value);
  return Boolean(decoded?.customerCode && decoded.username);
}

function hasStaffSession(request: NextRequest) {
  const value = request.cookies.get("uk-warehouse-staff-session")?.value;
  if (!value) return false;

  const decoded = parseSignedSessionPayload<{ username: string; displayName: string; role: string }>(value);
  return Boolean(decoded?.username && decoded.displayName && decoded.role);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isInternalPath(pathname)) return NextResponse.next();
  if (startsWithAny(pathname, publicCustomerGuidePrefixes)) return NextResponse.next();

  if ((pathname === "/login" || pathname === "/workspace" || pathname === "/app") && hasCustomerSession(request)) {
    return redirectTo(request, "customer", customerHomePath);
  }

  const surface = surfaceFromRequest(request);
  if (!surface) return NextResponse.next();

  if (surface === "admin") {
    if (pathname === "/" || pathname === "/admin") return redirectTo(request, "admin", hasStaffSession(request) ? adminHomePath : "/ops-login");
    if (startsWithAny(pathname, adminLoginPrefixes)) return NextResponse.next();
    if (startsWithAny(pathname, legacyAdminPrefixes)) {
      const destination = legacyAdminDestination(pathname);
      const loginPath = destination === "/boss/pda" ? `/ops-login?next=${encodeURIComponent(destination)}` : "/ops-login";
      return redirectTo(request, "admin", hasStaffSession(request) ? destination : loginPath);
    }
    if (startsWithAny(pathname, adminPrefixes) && !hasStaffSession(request)) {
      return redirectTo(request, "admin", `/ops-login?next=${encodeURIComponent(pathname)}`);
    }
    if (!startsWithAny(pathname, adminPrefixes)) return redirectTo(request, "admin", hasStaffSession(request) ? adminHomePath : "/ops-login");
    return NextResponse.next();
  }

  if (surface === "customer") {
    if (pathname === "/" || pathname === "/app") return redirectTo(request, "customer", hasCustomerSession(request) ? customerHomePath : "/login");
    if ((pathname === "/login" || pathname === "/workspace" || pathname === "/portal") && hasCustomerSession(request)) return redirectTo(request, "customer", customerHomePath);
    if (startsWithAny(pathname, protectedCustomerPrefixes) && !hasCustomerSession(request)) return redirectTo(request, "customer", "/login");
    if (startsWithAny(pathname, [...adminPrefixes, ...legacyAdminPrefixes])) {
      return hasSurfaceUrl("admin") ? redirectTo(request, "admin", legacyAdminDestination(pathname)) : redirectTo(request, "customer", "/login");
    }
    if (startsWithAny(pathname, customerPrefixes)) return NextResponse.next();
    if (startsWithAny(pathname, marketingPrefixes)) return redirectTo(request, "customer", "/login");
    return NextResponse.next();
  }

  if (startsWithAny(pathname, adminLoginPrefixes)) return NextResponse.next();
  if (startsWithAny(pathname, [...adminPrefixes, ...legacyAdminPrefixes])) {
    if (startsWithAny(pathname, adminPrefixes) && !hasStaffSession(request)) return redirectTo(request, "admin", "/ops-login");
    if (startsWithAny(pathname, adminPrefixes)) return NextResponse.next();
    if (!hasStaffSession(request)) return redirectTo(request, "admin", "/ops-login");
    return hasSurfaceUrl("admin") ? redirectTo(request, "admin", legacyAdminDestination(pathname)) : redirectTo(request, "marketing", "/");
  }
  if (startsWithAny(pathname, customerPrefixes) || pathname === "/app") {
    if ((pathname === "/login" || pathname === "/app" || pathname === "/portal") && hasCustomerSession(request)) return redirectTo(request, "customer", customerHomePath);
    if (startsWithAny(pathname, protectedCustomerPrefixes) && !hasCustomerSession(request)) return redirectTo(request, "customer", "/login");
    return redirectTo(request, "customer", `${pathname}${request.nextUrl.search}`);
  }
  if ((pathname === "/login" || pathname === "/workspace") && hasCustomerSession(request)) {
    return redirectTo(request, "customer", customerHomePath);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
