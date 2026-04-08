import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLearnerCookie, verifyLearnerToken } from "@/lib/learner/token";
import { prisma } from "@/lib/prisma";
import { LessonContent } from "./lesson-content";

async function resolveStudentId(): Promise<string | null> {
  const session = await auth();
  if (session?.user && session.user.role === UserRole.STUDENT) {
    return session.user.id;
  }

  const cookie = await getLearnerCookie();
  if (!cookie) return null;

  const payload = await verifyLearnerToken(cookie);
  if (!payload?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true },
  });

  return user?.id ?? null;
}

type PageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function LessonPage({ params }: PageProps) {
  const studentId = await resolveStudentId();
  if (!studentId) {
    redirect("/");
  }

  await params;

  const exercise = await prisma.drawingExercise.findFirst({
    where: { unitNumber: 4, lessonNumber: 1, status: "ACTIVE" },
    select: { id: true, slug: true, titleTr: true, descriptionTr: true, templateSpec: true },
  });

  // Start/get exercise attempt for embedding
  let exerciseAttempt = null;
  if (exercise) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001");

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const res = await fetch(`${baseUrl}/api/student/exercise/${exercise.id}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookieHeader },
    }).catch(() => null);

    if (res?.ok) {
      exerciseAttempt = await res.json().catch(() => null);
    }
  }

  return (
    <main className="dark-theme app-wrap lesson-app-wrap">
      <div className="launch-aurora" aria-hidden="true">
        <div className="aurora-blob blob-1" />
        <div className="aurora-blob blob-2" />
        <div className="aurora-blob blob-3" />
      </div>
      <div className="launch-grid-overlay" aria-hidden="true" />
      <div className="launch-grain" aria-hidden="true" />

      <LessonContent exercise={exercise} exerciseAttempt={exerciseAttempt} />
    </main>
  );
}
