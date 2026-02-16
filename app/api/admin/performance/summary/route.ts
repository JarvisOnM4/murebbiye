import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { summarizePerformance } from "@/lib/performance/repository";

export const runtime = "nodejs";

const querySchema = z.object({
  windowMinutes: z.coerce.number().int().min(1).max(1440).default(60),
  targetMs: z.coerce.number().int().min(100).max(10000).default(3000)
});

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    windowMinutes: url.searchParams.get("windowMinutes") ?? undefined,
    targetMs: url.searchParams.get("targetMs") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        errors: parsed.error.issues.map((issue) => issue.message)
      },
      { status: 400 }
    );
  }

  const summary = await summarizePerformance(parsed.data.windowMinutes, parsed.data.targetMs);
  return NextResponse.json({ summary }, { status: 200 });
}
