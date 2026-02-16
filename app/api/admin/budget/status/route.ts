import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getBudgetStatus } from "@/lib/budget/service";
import { withPerformanceMetric } from "@/lib/performance/measure";

export const runtime = "nodejs";

const querySchema = z.object({
  perLessonEstimateUsd: z.coerce.number().positive().max(5).default(0.05)
});

export async function GET(request: Request) {
  return withPerformanceMetric("GET /api/admin/budget/status", async () => {
    const session = await auth();

    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      perLessonEstimateUsd: url.searchParams.get("perLessonEstimateUsd") ?? undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          errors: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      );
    }

    const status = await getBudgetStatus(parsed.data.perLessonEstimateUsd);
    return NextResponse.json({ status }, { status: 200 });
  });
}
