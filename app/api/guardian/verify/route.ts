import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Doğrulama tokeni eksik." },
      { status: 400 }
    );
  }

  const link = await prisma.guardianLink.findUnique({
    where: { verificationToken: token },
  });

  if (!link) {
    return NextResponse.json(
      { error: "Geçersiz veya süresi dolmuş doğrulama bağlantısı." },
      { status: 404 }
    );
  }

  if (link.verified) {
    const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl}/guardian?verified=true`);
  }

  if (new Date() > link.expiresAt) {
    return NextResponse.json(
      { error: "Doğrulama bağlantısının süresi dolmuş. Lütfen tekrar deneyin." },
      { status: 410 }
    );
  }

  await prisma.guardianLink.update({
    where: { id: link.id },
    data: { verified: true },
  });

  const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return NextResponse.redirect(`${baseUrl}/guardian?verified=true`);
}
