import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchCurriculumDocuments } from "@/lib/curriculum/service";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const payload = await fetchCurriculumDocuments();
  return NextResponse.json(payload, { status: 200 });
}
