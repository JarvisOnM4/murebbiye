import { UserRole } from "@prisma/client"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { listApprovedAssetsForLesson } from "@/lib/media-agent/service"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{
    lessonId: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth()

  if (!session?.user || (session.user.role !== UserRole.STUDENT && session.user.role !== UserRole.ADMIN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { lessonId } = await params
  const assets = await listApprovedAssetsForLesson(lessonId)

  return NextResponse.json({ assets }, { status: 200 })
}
