import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLearnerCookie, verifyLearnerToken } from "@/lib/learner/token";
import { prisma } from "@/lib/prisma";
import { DrawingExercise } from "./drawing-exercise";

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
  params: Promise<{ exerciseId: string }>;
};

export default async function ExercisePage({ params }: PageProps) {
  const studentId = await resolveStudentId();
  if (!studentId) {
    redirect("/");
  }

  const { exerciseId } = await params;

  // Call the start API to get or create an attempt
  // We call the API directly here so auth cookies are forwarded correctly
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/student/exercise/${exerciseId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Forward cookies so the identity check passes
    credentials: "include",
  }).catch(() => null);

  if (!res || !res.ok) {
    // Exercise not found or not authorized — redirect home
    redirect("/student");
  }

  const data = await res.json().catch(() => null);

  if (!data?.exercise || !data?.attemptId) {
    redirect("/student");
  }

  return (
    <main className="dark-theme app-wrap exercise-app-wrap">
      <div className="launch-aurora" aria-hidden="true">
        <div className="aurora-blob blob-1" />
        <div className="aurora-blob blob-2" />
        <div className="aurora-blob blob-3" />
      </div>
      <div className="launch-grid-overlay" aria-hidden="true" />
      <div className="launch-grain" aria-hidden="true" />

      <div className="exercise-shell">
        <DrawingExercise
          exerciseId={exerciseId}
          attemptId={data.attemptId}
          exercise={data.exercise}
          attempt={data.attempt}
        />
      </div>
    </main>
  );
}
