import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getStudentIdentity } from "@/lib/learner/identity";
import { checkRateLimit } from "@/lib/learner/rate-limit";

export const runtime = "nodejs";

const requestSchema = z.object({
  pin: z
    .string()
    .regex(/^\d{4}$/, "PIN 4 haneli bir sayı olmalı."),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateCheck = await checkRateLimit(ip, "learner-pin", 3, 3600);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme. Lütfen bekleyin." },
      { status: 429 }
    );
  }

  const identity = await getStudentIdentity();

  if (!identity) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 403 }
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

  const pinHash = await bcrypt.hash(parsed.data.pin, 10);

  await prisma.user.update({
    where: { id: identity.id },
    data: { pinHash },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
