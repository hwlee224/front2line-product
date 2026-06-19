// ============================================================================
// [4단계] middleware.ts  →  이 내용으로 "전체 교체"
//
// 바뀐 점은 단 한 줄: 비밀번호 잠금 예외 목록에 "/api/export" 추가.
//   → /api/export 만 비밀번호 없이 통과 (대신 export 자체의 token 으로 보호됨)
//   → 나머지 페이지는 기존처럼 비밀번호 잠금 그대로 유지
// ============================================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/export") || // ★추가: export 엔드포인트는 비밀번호 잠금 예외
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";
  if (isPublicPath) {
    return NextResponse.next();
  }
  const sitePassword = process.env.SITE_PASSWORD || "f2l1234567";
  const accessCookie = request.cookies.get("f2l_access")?.value;
  if (accessCookie !== sitePassword) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};
