import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { listParentSummaryReports } from "@/lib/reporting/service";
import { withPerformanceMetric } from "@/lib/performance/measure";

export const runtime = "nodejs";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export async function GET(request: Request) {
  return withPerformanceMetric("GET /api/admin/reports/parent-summaries", async () => {
    const session = await auth();

    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          errors: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      );
    }

    const summaries = await listParentSummaryReports(parsed.data.limit);

    return NextResponse.json(
      {
        summaries,
        count: summaries.length
      },
      { status: 200 }
    );
  });
}
