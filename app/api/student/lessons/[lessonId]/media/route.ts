import { UserRole } from "@prisma/client"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { listApprovedAssetsForLesson } from "@/lib/media-agent/service"
import { getStudentIdentity } from "@/lib/learner/identity"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{
    lessonId: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  // Try admin auth first
  const session = await auth()
  if (session?.user && session.user.role === UserRole.ADMIN) {
    const { lessonId } = await params
    const assets = await listApprovedAssetsForLesson(lessonId)
    return NextResponse.json({ assets }, { status: 200 })
  }

  // Try student identity (NextAuth or learner cookie)
  const identity = await getStudentIdentity()
  if (identity) {
    const { lessonId } = await params
    const assets = await listApprovedAssetsForLesson(lessonId)
    return NextResponse.json({ assets }, { status: 200 })
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
}
