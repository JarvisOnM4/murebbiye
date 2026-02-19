import { UserRole } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { listAssets } from "@/lib/media-agent/service"

export const runtime = "nodejs"

const querySchema = z.object({
  documentId: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export async function GET(request: Request) {
  const session = await auth()

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    documentId: url.searchParams.get("documentId") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
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

  const { limit: _limit, ...filters } = parsed.data
  const assets = await listAssets(filters)

  return NextResponse.json(
    {
      assets,
      total: assets.length,
    },
    { status: 200 }
  )
}
