import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole, AuthMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateUniqueRecoveryCode } from "@/lib/learner/recovery-code";
import { createLearnerToken, setLearnerCookie } from "@/lib/learner/token";
import { checkRateLimit } from "@/lib/learner/rate-limit";

export const runtime = "nodejs";

const requestSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2, "Takma ad en az 2 karakter olmalı.")
    .max(30, "Takma ad en fazla 30 karakter olabilir.")
    .transform((v) => v.replace(/<[^>]*>/g, "").trim())
    .refine((v) => v.length >= 2, "Takma ad en az 2 karakter olmalı."),
});

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rateCheck = await checkRateLimit(ip, "learner-start", 5, 3600);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Çok fazla hesap oluşturma denemesi. Lütfen bekleyin." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const recoveryCode = await generateUniqueRecoveryCode();
  const learnerToken = crypto.randomUUID();

  const user = await prisma.user.create({
    data: {
      role: UserRole.STUDENT,
      authMode: AuthMode.LEARNER_TOKEN,
      nickname: parsed.data.nickname,
      recoveryCode,
      learnerToken,
      lastActiveAt: new Date(),
    },
  });

  const jwt = await createLearnerToken(user.id);
  await setLearnerCookie(jwt);

  return NextResponse.json(
    {
      userId: user.id,
      nickname: user.nickname,
      recoveryCode,
    },
    { status: 201 }
  );
}
