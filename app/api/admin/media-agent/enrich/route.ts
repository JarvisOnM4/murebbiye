import { MediaAssetType, UserRole } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { startEnrichment } from "@/lib/media-agent/service"

export const runtime = "nodejs"

const enrichSchema = z.object({
  documentId: z.string().trim().min(1),
  locale: z.enum(["tr", "en"]).optional(),
  mediaTypes: z.array(z.nativeEnum(MediaAssetType)).optional(),
})

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Enrichment failed."
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = enrichSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        errors: parsed.error.issues.map((issue) => issue.message),
      },
      { status: 400 }
    )
  }

  try {
    const job = await startEnrichment(parsed.data)
    return NextResponse.json({ job }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        errors: [toErrorMessage(error)],
      },
      { status: 422 }
    )
  }
}
