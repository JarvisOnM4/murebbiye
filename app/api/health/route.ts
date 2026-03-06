import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  let dbStatus = "connected"

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = "unreachable"
  }

  const dbOk = dbStatus === "connected"
  const status = dbOk ? "ok" : "degraded"

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ status: dbOk ? "ok" : "degraded" });
  }

  return NextResponse.json(
    {
      status,
      service: "murebbiye",
      db: dbStatus,
      timestamp: new Date().toISOString()
    },
    { status: dbOk ? 200 : 503 }
  )
}
