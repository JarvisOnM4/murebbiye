import { LessonTrack, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { generateLessonDraft, listLessonDrafts } from "@/lib/lesson/service";
import { withPerformanceMetric } from "@/lib/performance/measure";

export const runtime = "nodejs";

const createDraftSchema = z.object({
  track: z.nativeEnum(LessonTrack).default(LessonTrack.ENGLISH),
  locale: z.enum(["tr", "en"]).default("tr"),
  studentId: z.string().trim().min(1).optional(),
  focusTopic: z.string().trim().min(2).max(140).optional()
});

const listDraftSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  studentId: z.string().trim().min(1).optional()
});

function asErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Lesson draft generation failed.";
}

export async function POST(request: Request) {
  return withPerformanceMetric("POST /api/admin/lessons/draft", async () => {
    const session = await auth();

    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = createDraftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          errors: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      );
    }

    try {
      const draft = await generateLessonDraft({
        studentId: parsed.data.studentId ?? session.user.id,
        locale: parsed.data.locale,
        track: parsed.data.track,
        focusTopic: parsed.data.focusTopic
      });

      return NextResponse.json({ draft }, { status: 200 });
    } catch (error) {
      return NextResponse.json(
        {
          errors: [asErrorMessage(error)]
        },
        { status: 422 }
      );
    }
  });
}

export async function GET(request: Request) {
  return withPerformanceMetric("GET /api/admin/lessons/draft", async () => {
    const session = await auth();

    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(request.url);
    const parsed = listDraftSchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      studentId: url.searchParams.get("studentId") ?? undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          errors: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      );
    }

    const drafts = await listLessonDrafts({
      studentId: parsed.data.studentId,
      limit: parsed.data.limit
    });

    return NextResponse.json(
      {
        drafts,
        count: drafts.length
      },
      { status: 200 }
    );
  });
}
