import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { z } from "zod"

// Re-create the schema locally to test validation without triggering
// the side-effect of parsing process.env at import time.
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

function validEnv(overrides: Record<string, string> = {}) {
  return {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    NEXTAUTH_SECRET: "test-secret-at-least-1-char",
    NEXTAUTH_URL: "http://localhost:3000",
    APP_BASE_URL: "http://localhost:3000",
    MONTHLY_CAP_USD: "10",
    PER_LESSON_CAP_USD: "0.2",
    BUDGET_MODE_AT_80_PERCENT: "short_response_low_cost_model",
    BUDGET_MODE_AT_100_PERCENT: "stop_new_generation_review_only",
    ...overrides,
  }
}

describe("env validation", () => {
  it("parses a complete valid env", () => {
    const result = envSchema.parse(validEnv())
    expect(result.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/db")
    expect(result.DEFAULT_LOCALE).toBe("tr")
    expect(result.UPLOAD_MAX_MB).toBe(20)
    expect(result.AWS_REGION).toBe("us-east-1")
  })

  it("rejects missing DATABASE_URL", () => {
    const env = validEnv()
    delete (env as Record<string, string>).DATABASE_URL
    expect(() => envSchema.parse(env)).toThrow()
  })

  it("rejects invalid NEXTAUTH_URL", () => {
    expect(() => envSchema.parse(validEnv({ NEXTAUTH_URL: "not-a-url" }))).toThrow()
  })

  it("coerces numeric strings", () => {
    const result = envSchema.parse(validEnv({ MONTHLY_CAP_USD: "25.5" }))
    expect(result.MONTHLY_CAP_USD).toBe(25.5)
  })

  it("rejects negative budget cap", () => {
    expect(() => envSchema.parse(validEnv({ MONTHLY_CAP_USD: "-1" }))).toThrow()
  })

  it("transforms AUTH_ALLOW_ENV_FALLBACK to boolean", () => {
    const t = envSchema.parse(validEnv({ AUTH_ALLOW_ENV_FALLBACK: "true" }))
    expect(t.AUTH_ALLOW_ENV_FALLBACK).toBe(true)

    const f = envSchema.parse(validEnv({ AUTH_ALLOW_ENV_FALLBACK: "false" }))
    expect(f.AUTH_ALLOW_ENV_FALLBACK).toBe(false)
  })

  it("defaults locale to tr", () => {
    const result = envSchema.parse(validEnv())
    expect(result.DEFAULT_LOCALE).toBe("tr")
  })

  it("accepts en locale", () => {
    const result = envSchema.parse(validEnv({ DEFAULT_LOCALE: "en" }))
    expect(result.DEFAULT_LOCALE).toBe("en")
  })

  it("rejects unsupported locale", () => {
    expect(() => envSchema.parse(validEnv({ DEFAULT_LOCALE: "fr" }))).toThrow()
  })

  it("allows optional S3_BUCKET_NAME", () => {
    const result = envSchema.parse(validEnv())
    expect(result.S3_BUCKET_NAME).toBeUndefined()
  })

  it("parses S3_BUCKET_NAME when provided", () => {
    const result = envSchema.parse(validEnv({ S3_BUCKET_NAME: "my-bucket" }))
    expect(result.S3_BUCKET_NAME).toBe("my-bucket")
  })
})
