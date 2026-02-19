import { UserRole } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { reviewStoryboard } from "@/lib/media-agent/service"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{
    assetId: string
  }>
}

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().min(1).optional(),
})

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Review failed."
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth()

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { assetId } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = reviewSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        errors: parsed.error.issues.map((issue) => issue.message),
      },
      { status: 400 }
    )
  }

  try {
    const asset = await reviewStoryboard({
      assetId,
      action: parsed.data.action,
      reviewedBy: session.user.id,
      rejectionReason: parsed.data.rejectionReason,
    })

    return NextResponse.json({ asset }, { status: 200 })
  } catch (error) {
    const message = toErrorMessage(error)

    if (message.includes("not found")) {
      return NextResponse.json(
        {
          errors: [message],
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        errors: [message],
      },
      { status: 422 }
    )
  }
}
