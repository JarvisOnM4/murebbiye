import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/learner/rate-limit";

export const runtime = "nodejs";

const requestSchema = z.object({
  recoveryCode: z.string().trim().min(5).toUpperCase(),
  email: z.string().email("Geçerli bir e-posta adresi girin."),
});

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rateCheck = await checkRateLimit(ip, "guardian-link", 3, 3600);
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

  const learner = await prisma.user.findUnique({
    where: { recoveryCode: parsed.data.recoveryCode },
    select: { id: true },
  });

  if (!learner) {
    return NextResponse.json(
      { error: "Kurtarma kodu bulunamadı." },
      { status: 404 }
    );
  }

  const guardianEmail = parsed.data.email.toLowerCase().trim();

  // Check for existing link
  const existing = await prisma.guardianLink.findUnique({
    where: {
      learnerId_guardianEmail: {
        learnerId: learner.id,
        guardianEmail,
      },
    },
  });

  if (existing?.verified) {
    return NextResponse.json(
      { error: "Bu e-posta zaten doğrulanmış." },
      { status: 409 }
    );
  }

  const verificationToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

  if (existing) {
    // Update existing unverified link
    await prisma.guardianLink.update({
      where: { id: existing.id },
      data: {
        verificationToken,
        expiresAt,
        consentGivenAt: new Date(),
      },
    });
  } else {
    await prisma.guardianLink.create({
      data: {
        learnerId: learner.id,
        guardianEmail,
        verificationToken,
        expiresAt,
        consentGivenAt: new Date(),
      },
    });
  }

  // In production, send verification email here.
  // For now, log the verification URL.
  const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verifyUrl = `${baseUrl}/api/guardian/verify?token=${verificationToken}`;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[guardian] Verification URL: ${verifyUrl}`);
  }

  return NextResponse.json(
    { message: "Doğrulama e-postası gönderildi." },
    { status: 200 }
  );
}
