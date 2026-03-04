import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createLearnerToken, setLearnerCookie } from "@/lib/learner/token";
import { checkRateLimit } from "@/lib/learner/rate-limit";

export const runtime = "nodejs";

const requestSchema = z.object({
  recoveryCode: z
    .string()
    .trim()
    .min(5, "Kurtarma kodu gerekli.")
    .toUpperCase(),
  pin: z
    .string()
    .regex(/^\d{4}$/, "PIN 4 haneli olmalı.")
    .optional(),
});

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rateCheck = await checkRateLimit(ip, "learner-resume", 5, 3600);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme. Lütfen bekleyin." },
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

  const user = await prisma.user.findUnique({
    where: { recoveryCode: parsed.data.recoveryCode },
    select: {
      id: true,
      nickname: true,
      pinHash: true,
      recoveryCode: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Kurtarma kodu bulunamadı." },
      { status: 404 }
    );
  }

  // If user has a PIN set, require it
  if (user.pinHash) {
    if (!parsed.data.pin) {
      return NextResponse.json(
        { error: "Bu hesap için PIN gerekli.", pinRequired: true },
        { status: 403 }
      );
    }

    const pinValid = await bcrypt.compare(parsed.data.pin, user.pinHash);
    if (!pinValid) {
      return NextResponse.json(
        { error: "Yanlış PIN." },
        { status: 403 }
      );
    }
  }

  // Rotate learner token (invalidates old device)
  const newToken = crypto.randomUUID();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      learnerToken: newToken,
      lastActiveAt: new Date(),
    },
  });

  const jwt = await createLearnerToken(user.id);
  await setLearnerCookie(jwt);

  return NextResponse.json(
    {
      userId: user.id,
      nickname: user.nickname,
    },
    { status: 200 }
  );
}
