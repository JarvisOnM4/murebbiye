import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { markDbFailure, markDbSuccess, shouldAttemptDb } from "@/lib/persistence";
import type { BudgetLedgerEntry } from "@/lib/budget/types";

type CreateBudgetLedgerEntryInput = {
  lessonId?: string;
  provider: string;
  model: string;
  requestType: string;
  costUsd: number;
  tokensIn?: number;
  tokensOut?: number;
};

type FallbackBudgetLedgerEntry = {
  id: string;
  lessonId: string | null;
  provider: string;
  model: string;
  requestType: string;
  costUsd: number;
  tokensIn: number | null;
  tokensOut: number | null;
  createdAt: string;
};

type FallbackBudgetIndex = {
  entries: FallbackBudgetLedgerEntry[];
};

const STORAGE_ROOT = path.join(process.cwd(), "storage");
const FALLBACK_ROOT = path.join(STORAGE_ROOT, "fallback");
const FALLBACK_INDEX_FILE = path.join(FALLBACK_ROOT, "budget-index.json");

function round4(value: number) {
  return Number(value.toFixed(4));
}

function mapDbEntry(entry: {
  id: string;
  lessonId: string | null;
  provider: string;
  model: string;
  requestType: string;
  costUsd: { toNumber(): number };
  tokensIn: number | null;
  tokensOut: number | null;
  createdAt: Date;
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
    createdAt: entry.createdAt.toISOString(),
    persistence: "db"
  };
}

function mapFallbackEntry(entry: FallbackBudgetLedgerEntry): BudgetLedgerEntry {
  return {
    id: entry.id,
    lessonId: entry.lessonId,
    provider: entry.provider,
    model: entry.model,
    requestType: entry.requestType,
    costUsd: round4(entry.costUsd),
    tokensIn: entry.tokensIn,
    tokensOut: entry.tokensOut,
    createdAt: entry.createdAt,
    persistence: "fallback"
  };
}

async function ensureStorageStructure() {
  await fs.mkdir(FALLBACK_ROOT, { recursive: true });

  try {
    await fs.access(FALLBACK_INDEX_FILE);
  } catch {
    await fs.writeFile(FALLBACK_INDEX_FILE, JSON.stringify({ entries: [] }, null, 2), "utf-8");
  }
}

async function readFallbackIndex(): Promise<FallbackBudgetIndex> {
  await ensureStorageStructure();
  const raw = await fs.readFile(FALLBACK_INDEX_FILE, "utf-8");
  const parsed = JSON.parse(raw) as FallbackBudgetIndex;

  return {
    entries: parsed.entries ?? []
  };
}

async function writeFallbackIndex(index: FallbackBudgetIndex) {
  await fs.writeFile(FALLBACK_INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
}

export async function createBudgetLedgerEntry(
  input: CreateBudgetLedgerEntryInput
): Promise<BudgetLedgerEntry> {
  const normalizedCost = round4(Math.max(0, input.costUsd));

  if (shouldAttemptDb()) {
    try {
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
      });

      markDbSuccess();
      return mapDbEntry(created);
    } catch {
      markDbFailure();
    }
  }

  const index = await readFallbackIndex();
  const now = new Date().toISOString();

  const fallbackRecord: FallbackBudgetLedgerEntry = {
    id: randomUUID(),
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
        : null,
    createdAt: now
  };

  index.entries.unshift(fallbackRecord);
  await writeFallbackIndex(index);
  return mapFallbackEntry(fallbackRecord);
}

export async function listBudgetLedgerEntriesSince(startAt: Date): Promise<BudgetLedgerEntry[]> {
  const items: BudgetLedgerEntry[] = [];

  if (shouldAttemptDb()) {
    try {
      const dbRecords = await prisma.budgetLedger.findMany({
        where: {
          createdAt: {
            gte: startAt
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      markDbSuccess();
      items.push(...dbRecords.map(mapDbEntry));
    } catch {
      markDbFailure();
    }
  }

  const index = await readFallbackIndex();

  items.push(
    ...index.entries
      .filter((entry) => Date.parse(entry.createdAt) >= startAt.getTime())
      .map(mapFallbackEntry)
  );

  const unique = new Map<string, BudgetLedgerEntry>();

  for (const entry of items) {
    unique.set(entry.id, entry);
  }

  return [...unique.values()].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
  );
}

export async function resetBudgetLedgerSince(startAt: Date) {
  if (shouldAttemptDb()) {
    try {
      await prisma.budgetLedger.deleteMany({
        where: {
          createdAt: {
            gte: startAt
          }
        }
      });
      markDbSuccess();
    } catch {
      markDbFailure();
    }
  }

  const index = await readFallbackIndex();
  const filtered = index.entries.filter((entry) => Date.parse(entry.createdAt) < startAt.getTime());

  if (filtered.length !== index.entries.length) {
    index.entries = filtered;
    await writeFallbackIndex(index);
  }
}
