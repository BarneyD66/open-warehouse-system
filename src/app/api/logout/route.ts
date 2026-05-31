import { NextResponse } from "next/server";
import { staffCookieName } from "@/lib/staffAuth";

export async function POST(request: Request) {
  const redirectTarget = new URL(request.url).searchParams.get("next") || "/login";
  const response = NextResponse.redirect(new URL(redirectTarget, request.url), { status: 303 });
  response.cookies.set("uk-warehouse-session", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set(staffCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
