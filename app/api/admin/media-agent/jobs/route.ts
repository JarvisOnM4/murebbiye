import { UserRole } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { listJobs } from "@/lib/media-agent/service"

export const runtime = "nodejs"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export async function GET(request: Request) {
  const session = await auth()

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      {
        errors: parsed.error.issues.map((issue) => issue.message),
      },
      { status: 400 }
    )
  }

  const jobs = await listJobs(parsed.data.limit)

  return NextResponse.json(
    {
      jobs,
      total: jobs.length,
    },
    { status: 200 }
  )
}
