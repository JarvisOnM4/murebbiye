import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { z } from "zod"

// Replicate the schema from env.ts so we can test it in isolation
// without triggering the module-level parse that reads process.env
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  APP_BASE_URL: z.string().url(),
  DEFAULT_LOCALE: z.enum(["tr", "en"]).default("tr"),
  SUPPORTED_LOCALES: z.string().default("tr,en"),
  MONTHLY_CAP_USD: z.coerce.number().positive(),
  PER_LESSON_CAP_USD: z.coerce.number().positive(),
  BUDGET_MODE_AT_80_PERCENT: z.string().min(1),
  BUDGET_MODE_AT_100_PERCENT: z.string().min(1),
  UPLOAD_MAX_MB: z.coerce.number().int().positive().default(20),
  AUTH_ALLOW_ENV_FALLBACK: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  SMTP_FROM: z.string().optional(),
  AWS_REGION: z.string().default("us-east-1"),
  S3_BUCKET_NAME: z.string().min(1).optional(),
})

function validEnv() {
  return {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    NEXTAUTH_SECRET: "super-secret-key-1234567890",
    NEXTAUTH_URL: "http://localhost:3000",
    APP_BASE_URL: "http://localhost:3000",
    DEFAULT_LOCALE: "tr",
    SUPPORTED_LOCALES: "tr,en",
    MONTHLY_CAP_USD: "10",
    PER_LESSON_CAP_USD: "0.2",
    BUDGET_MODE_AT_80_PERCENT: "short_response_low_cost_model",
    BUDGET_MODE_AT_100_PERCENT: "stop_new_generation_review_only",
    UPLOAD_MAX_MB: "20",
    AWS_REGION: "us-east-1",
  }
}

describe("env schema validation", () => {
  it("should parse valid environment variables", () => {
    const result = envSchema.parse(validEnv())

    expect(result.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/db")
    expect(result.MONTHLY_CAP_USD).toBe(10)
    expect(result.PER_LESSON_CAP_USD).toBe(0.2)
    expect(result.DEFAULT_LOCALE).toBe("tr")
    expect(result.AUTH_ALLOW_ENV_FALLBACK).toBe(false)
  })

  it("should coerce string numbers to numeric values", () => {
    const result = envSchema.parse(validEnv())

    expect(typeof result.MONTHLY_CAP_USD).toBe("number")
    expect(typeof result.PER_LESSON_CAP_USD).toBe("number")
    expect(typeof result.UPLOAD_MAX_MB).toBe("number")
  })

  it("should apply defaults for optional fields", () => {
    const input = { ...validEnv() }
    delete (input as Record<string, unknown>).DEFAULT_LOCALE
    delete (input as Record<string, unknown>).SUPPORTED_LOCALES
    delete (input as Record<string, unknown>).UPLOAD_MAX_MB
    delete (input as Record<string, unknown>).AWS_REGION

    const result = envSchema.parse(input)

    expect(result.DEFAULT_LOCALE).toBe("tr")
    expect(result.SUPPORTED_LOCALES).toBe("tr,en")
    expect(result.UPLOAD_MAX_MB).toBe(20)
    expect(result.AWS_REGION).toBe("us-east-1")
  })

  it("should throw when DATABASE_URL is missing", () => {
    const input = { ...validEnv() }
    delete (input as Record<string, unknown>).DATABASE_URL

    expect(() => envSchema.parse(input)).toThrow()
  })

  it("should throw when NEXTAUTH_SECRET is missing", () => {
    const input = { ...validEnv() }
    delete (input as Record<string, unknown>).NEXTAUTH_SECRET

    expect(() => envSchema.parse(input)).toThrow()
  })

  it("should throw when NEXTAUTH_URL is not a valid URL", () => {
    const input = { ...validEnv(), NEXTAUTH_URL: "not-a-url" }

    expect(() => envSchema.parse(input)).toThrow()
  })

  it("should throw when MONTHLY_CAP_USD is zero or negative", () => {
    const input = { ...validEnv(), MONTHLY_CAP_USD: "0" }

    expect(() => envSchema.parse(input)).toThrow()
  })

  it("should transform AUTH_ALLOW_ENV_FALLBACK to boolean", () => {
    const withTrue = envSchema.parse({ ...validEnv(), AUTH_ALLOW_ENV_FALLBACK: "true" })
    expect(withTrue.AUTH_ALLOW_ENV_FALLBACK).toBe(true)

    const withFalse = envSchema.parse({ ...validEnv(), AUTH_ALLOW_ENV_FALLBACK: "false" })
    expect(withFalse.AUTH_ALLOW_ENV_FALLBACK).toBe(false)
  })
})
