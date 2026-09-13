import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/token";

const SESSION_COOKIE = "vipers_session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicAdminPath = pathname === "/admin/login";
  const isProtected = pathname.startsWith("/admin") && !isPublicAdminPath;
  const isApiProtected = pathname.startsWith("/api/admin");

  if (!isProtected && !isApiProtected) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const payload = secret ? await verifyToken(token, secret) : null;

  if (!payload) {
    if (isApiProtected) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
