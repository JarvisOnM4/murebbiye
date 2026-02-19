import { UserRole } from "@prisma/client"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getAsset } from "@/lib/media-agent/service"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{
    assetId: string
  }>
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Failed to retrieve media asset."
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth()

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { assetId } = await params

  try {
    const asset = await getAsset(assetId)
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
