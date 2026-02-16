import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { retryCurriculumIngestion } from "@/lib/curriculum/service";

export const runtime = "nodejs";

const retrySchema = z.object({
  documentId: z.string().min(1)
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = retrySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        errors: parsed.error.issues.map((issue) => issue.message)
      },
      { status: 400 }
    );
  }

  const result = await retryCurriculumIngestion(parsed.data.documentId);

  if (!result) {
    return NextResponse.json(
      {
        errors: ["Curriculum document not found."]
      },
      { status: 404 }
    );
  }

  if (result.errors.length > 0) {
    return NextResponse.json(result, { status: 422 });
  }

  return NextResponse.json(result, { status: 200 });
}
