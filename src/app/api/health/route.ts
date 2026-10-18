import { NextResponse } from "next/server";
import { evaluateLaunchReadiness, type LaunchSurface } from "@/lib/launchReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function surfaceFromHost(host: string) {
  const hostname = host.split(":")[0].toLowerCase();
  if (hostname.startsWith("admin.") || hostname.includes("-admin.")) return "admin" satisfies LaunchSurface;
  if (hostname.startsWith("app.") || hostname.startsWith("portal.") || hostname.startsWith("customer.") || hostname.includes("-app.")) return "customer" satisfies LaunchSurface;
  if (hostname.startsWith("www.") || hostname.includes("-web.")) return "marketing" satisfies LaunchSurface;
  return undefined;
}

export async function GET(request: Request) {
  const readiness = await evaluateLaunchReadiness(surfaceFromHost(request.headers.get("host") ?? ""));
  return NextResponse.json({
    ok: readiness.status !== "fail",
    status: readiness.status,
    score: readiness.score,
    environment: readiness.environment,
    generatedAt: readiness.generatedAt,
    metrics: readiness.metrics,
  }, {
    status: readiness.status === "fail" ? 503 : 200,
  });
}
