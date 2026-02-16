import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resetCurrentMonthBudgetUsage } from "@/lib/budget/service";
import { withPerformanceMetric } from "@/lib/performance/measure";

export const runtime = "nodejs";

export async function POST() {
  return withPerformanceMetric("POST /api/admin/budget/reset", async () => {
    const session = await auth();

    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const allowReset =
      process.env.ALLOW_ADMIN_RESET === "true" || process.env.NODE_ENV !== "production";

    if (!allowReset) {
      return NextResponse.json(
        {
          errors: ["Budget reset endpoint is disabled in this environment."]
        },
        { status: 403 }
      );
    }

    const status = await resetCurrentMonthBudgetUsage();
    return NextResponse.json({ status }, { status: 200 });
  });
}
