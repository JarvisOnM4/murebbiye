import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { simulateBudgetUsage } from "@/lib/budget/service";
import { withPerformanceMetric } from "@/lib/performance/measure";

export const runtime = "nodejs";

const simulateSchema = z.object({
  totalCostUsd: z.coerce.number().positive().max(100),
  count: z.coerce.number().int().min(1).max(200).default(1),
  requestType: z.string().trim().min(1).max(80).optional()
});

export async function POST(request: Request) {
  return withPerformanceMetric("POST /api/admin/budget/simulate", async () => {
    const session = await auth();

    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = simulateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          errors: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      );
    }

    const status = await simulateBudgetUsage(parsed.data);

    return NextResponse.json(
      {
        status
      },
      { status: 200 }
    );
  });
}
