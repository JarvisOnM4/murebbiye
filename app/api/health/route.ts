import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  let dbStatus = "connected"

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = "unreachable"
  }

  const status = dbStatus === "connected" ? "ok" : "degraded"

  return NextResponse.json(
    {
      status,
      service: "murebbiye",
      db: dbStatus,
      timestamp: new Date().toISOString()
    },
    { status: dbStatus === "connected" ? 200 : 503 }
  )
}
