import { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { getLearnerCookie, verifyLearnerToken } from "./token";

export type StudentIdentity = {
  id: string;
  role: "STUDENT";
  authMode: "CREDENTIALS" | "LEARNER_TOKEN";
  nickname: string | null;
};

/**
 * Resolve the current student identity.
 * Tries NextAuth session first, then falls back to signed learner cookie.
 * Returns null if neither yields a valid STUDENT identity.
 */
export async function getStudentIdentity(): Promise<StudentIdentity | null> {
  // 1. Try NextAuth session
  const session = await auth();
  if (session?.user && session.user.role === UserRole.STUDENT) {
    return {
      id: session.user.id,
      role: "STUDENT",
      authMode: "CREDENTIALS",
      nickname: session.user.nickname ?? null,
    };
  }

  // 2. Try learner cookie
  const cookieValue = await getLearnerCookie();
  if (!cookieValue) {
    return null;
  }

  const payload = await verifyLearnerToken(cookieValue);
  if (!payload?.sub) {
    return null;
  }

  return {
    id: payload.sub,
    role: "STUDENT",
    authMode: "LEARNER_TOKEN",
    nickname: null, // caller can fetch from DB if needed
  };
}
