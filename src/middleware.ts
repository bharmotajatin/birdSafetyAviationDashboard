import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = ["/login", "/error", "/favicon.ico"];

const ROLE_LEVEL: Record<string, number> = {
  viewer: 0,
  investigator: 1,
  duty_manager: 2,
  safety_head: 3,
  admin: 4,
};

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/cron/sla-check") return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const role = String((token as any).role ?? "viewer");
  const roleLevel = ROLE_LEVEL[role] ?? 0;

  if (pathname.startsWith("/admin/") && role !== "admin") {
    return NextResponse.redirect(new URL("/error?error=AccessDenied", req.url));
  }

  if (pathname.startsWith("/api/users") && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (pathname.startsWith("/api/incidents") && req.method === "POST" && roleLevel < ROLE_LEVEL.duty_manager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
