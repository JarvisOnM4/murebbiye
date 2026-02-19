import { prisma } from "@/lib/prisma"
import type { BudgetLedgerEntry } from "@/lib/budget/types"

type CreateBudgetLedgerEntryInput = {
  lessonId?: string
  provider: string
  model: string
  requestType: string
  costUsd: number
  tokensIn?: number
  tokensOut?: number
}

function round4(value: number) {
  return Number(value.toFixed(4))
}

function mapDbEntry(entry: {
  id: string
  lessonId: string | null
  provider: string
  model: string
  requestType: string
  costUsd: { toNumber(): number }
  tokensIn: number | null
  tokensOut: number | null
  createdAt: Date
}): BudgetLedgerEntry {
  return {
    id: entry.id,
    lessonId: entry.lessonId,
    provider: entry.provider,
    model: entry.model,
    requestType: entry.requestType,
    costUsd: round4(entry.costUsd.toNumber()),
    tokensIn: entry.tokensIn,
    tokensOut: entry.tokensOut,
    createdAt: entry.createdAt.toISOString()
  }
}

export async function createBudgetLedgerEntry(
  input: CreateBudgetLedgerEntryInput
): Promise<BudgetLedgerEntry> {
  const normalizedCost = round4(Math.max(0, input.costUsd))

  const created = await prisma.budgetLedger.create({
    data: {
      lessonId: input.lessonId ?? null,
      provider: input.provider,
      model: input.model,
      requestType: input.requestType,
      costUsd: normalizedCost,
      tokensIn:
        typeof input.tokensIn === "number" && Number.isFinite(input.tokensIn)
          ? Math.max(0, Math.floor(input.tokensIn))
          : null,
      tokensOut:
        typeof input.tokensOut === "number" && Number.isFinite(input.tokensOut)
          ? Math.max(0, Math.floor(input.tokensOut))
          : null
    }
  })

  return mapDbEntry(created)
}

export async function listBudgetLedgerEntriesSince(startAt: Date): Promise<BudgetLedgerEntry[]> {
  const dbRecords = await prisma.budgetLedger.findMany({
    where: {
      createdAt: {
        gte: startAt
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  })

  return dbRecords.map(mapDbEntry)
}

export async function resetBudgetLedgerSince(startAt: Date) {
  await prisma.budgetLedger.deleteMany({
    where: {
      createdAt: {
        gte: startAt
      }
    }
  })
}
