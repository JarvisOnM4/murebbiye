import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { dispatchParentSummaryQueue } from "@/lib/reporting/service";
import { withPerformanceMetric } from "@/lib/performance/measure";

export const runtime = "nodejs";

const dispatchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

export async function POST(request: Request) {
  return withPerformanceMetric("POST /api/admin/reports/parent-summaries/dispatch", async () => {
    const session = await auth();

    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = dispatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          errors: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      );
    }

    const result = await dispatchParentSummaryQueue(parsed.data.limit);
    return NextResponse.json({ result }, { status: 200 });
  });
}
