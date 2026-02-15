import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ADMIN_PATH = "/admin";
const STUDENT_PATH = "/student";
const LOGIN_PATH = "/login";

function dashboardForRole(role: string | undefined) {
  return role === "ADMIN" ? ADMIN_PATH : STUDENT_PATH;
}

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET
  });

  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname.startsWith(ADMIN_PATH);
  const isStudentPath = pathname.startsWith(STUDENT_PATH);
  const isProtectedPath = isAdminPath || isStudentPath;
  const isLoginPath = pathname === LOGIN_PATH;

  if (!token && isProtectedPath) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set(
      "callbackUrl",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(loginUrl);
  }

  if (token && isLoginPath) {
    return NextResponse.redirect(new URL(dashboardForRole(token.role as string), request.url));
  }

  if (token && isAdminPath && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL(STUDENT_PATH, request.url));
  }

  if (token && isStudentPath && token.role !== "STUDENT") {
    return NextResponse.redirect(new URL(ADMIN_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*", "/login"]
};
