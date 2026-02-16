import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resetPerformanceMetrics } from "@/lib/performance/repository";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const allowReset =
    process.env.ALLOW_ADMIN_RESET === "true" || process.env.NODE_ENV !== "production";

  if (!allowReset) {
    return NextResponse.json(
      {
        errors: ["Performance reset endpoint is disabled in this environment."]
      },
      { status: 403 }
    );
  }

  await resetPerformanceMetrics();
  return NextResponse.json({ ok: true }, { status: 200 });
}
