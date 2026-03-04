import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";

const ADMIN_PATH = "/admin";
const STUDENT_PATH = "/student";
const LOGIN_PATH = "/login";
const LEARNER_COOKIE = "learner_session";

function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured.");
  return new TextEncoder().encode(secret);
}

async function verifyLearnerCookie(
  request: NextRequest
): Promise<{ sub: string; role: string } | null> {
  const cookie = request.cookies.get(LEARNER_COOKIE)?.value;
  if (!cookie) return null;

  try {
    const { payload } = await jwtVerify(cookie, getJwtSecret());
    if (
      payload.sub &&
      payload.role === "STUDENT" &&
      payload.authMode === "LEARNER_TOKEN"
    ) {
      return { sub: payload.sub, role: "STUDENT" };
    }
    return null;
  } catch {
    return null;
  }
}

function dashboardForRole(role: string | undefined) {
  return role === "ADMIN" ? ADMIN_PATH : STUDENT_PATH;
}

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });

  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname.startsWith(ADMIN_PATH);
  const isStudentPath = pathname.startsWith(STUDENT_PATH);
  const isProtectedPath = isAdminPath || isStudentPath;
  const isLoginPath = pathname === LOGIN_PATH;

  // Admin paths — require NextAuth JWT with ADMIN role (unchanged)
  if (isAdminPath) {
    if (!token || token.role !== "ADMIN") {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      loginUrl.searchParams.set(
        "callbackUrl",
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      );
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Student paths — accept NextAuth JWT (STUDENT) OR valid learner cookie
  if (isStudentPath) {
    if (token && token.role === "STUDENT") {
      return NextResponse.next();
    }

    const learner = await verifyLearnerCookie(request);
    if (learner) {
      return NextResponse.next();
    }

    // Neither auth — redirect to landing (not login)
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Login path — redirect authenticated users to their dashboard
  if (isLoginPath && token) {
    return NextResponse.redirect(
      new URL(dashboardForRole(token.role as string), request.url)
    );
  }

  // Non-admin, non-student protected paths (future-proof)
  if (!token && isProtectedPath) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set(
      "callbackUrl",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*", "/login"],
};
