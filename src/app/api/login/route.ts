import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, signSession } from "@/lib/auth";
import { env } from "@/lib/env";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const from = String(form.get("from") ?? "/portfolio");

  if (!timingSafeEqual(password, env.ACCESS_PASSWORD)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "1");
    if (from && from !== "/portfolio") url.searchParams.set("from", from);
    return NextResponse.redirect(url, 303);
  }

  const token = await signSession();
  const target = from.startsWith("/") ? from : "/portfolio";
  const res = NextResponse.redirect(new URL(target, req.url), 303);
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
