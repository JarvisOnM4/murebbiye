import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getLessonDraftById } from "@/lib/lesson/service";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{
    lessonId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { lessonId } = await params;
  const draft = await getLessonDraftById(lessonId);

  if (!draft) {
    return NextResponse.json(
      {
        errors: ["Lesson draft not found."]
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ draft }, { status: 200 });
}
