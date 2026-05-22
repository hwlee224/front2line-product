import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const inputPassword = String(body.password || "");
  const sitePassword = process.env.SITE_PASSWORD || "f2l1234567";

  if (inputPassword !== sitePassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("f2l_access", sitePassword, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
