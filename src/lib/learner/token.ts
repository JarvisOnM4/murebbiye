import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "learner_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type LearnerTokenPayload = JWTPayload & {
  sub: string;
  role: "STUDENT";
  authMode: "LEARNER_TOKEN";
};

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Create a signed HS256 JWT for a learner session.
 */
export async function createLearnerToken(userId: string): Promise<string> {
  return new SignJWT({ role: "STUDENT", authMode: "LEARNER_TOKEN" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
}

/**
 * Verify a signed learner token and return the payload.
 * Returns null if invalid or expired.
 */
export async function verifyLearnerToken(
  token: string
): Promise<LearnerTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      payload.sub &&
      payload.role === "STUDENT" &&
      payload.authMode === "LEARNER_TOKEN"
    ) {
      return payload as LearnerTokenPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set the learner session cookie on the response.
 */
export async function setLearnerCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

/**
 * Read the learner session cookie value.
 */
export async function getLearnerCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

/**
 * Clear the learner session cookie.
 */
export async function clearLearnerCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
