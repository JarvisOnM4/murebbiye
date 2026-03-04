import { z } from "zod";

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
  BEDROCK_REGION: z.string().default("us-west-2"),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_BUCKET_NAME: z.string().min(1).optional(),
  BEDROCK_MODEL_ID: z.string().optional(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? process.env.AUTH_URL,
  APP_BASE_URL:
    process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? process.env.AUTH_URL,
  DEFAULT_LOCALE: process.env.DEFAULT_LOCALE ?? process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  SUPPORTED_LOCALES: process.env.SUPPORTED_LOCALES,
  MONTHLY_CAP_USD: process.env.MONTHLY_CAP_USD ?? process.env.BUDGET_MONTHLY_CAP_USD,
  PER_LESSON_CAP_USD:
    process.env.PER_LESSON_CAP_USD ?? process.env.BUDGET_PER_LESSON_CAP_USD,
  BUDGET_MODE_AT_80_PERCENT:
    process.env.BUDGET_MODE_AT_80_PERCENT ?? process.env.BUDGET_MODE_AT_80,
  BUDGET_MODE_AT_100_PERCENT:
    process.env.BUDGET_MODE_AT_100_PERCENT ?? process.env.BUDGET_MODE_AT_100,
  UPLOAD_MAX_MB: process.env.UPLOAD_MAX_MB,
  AUTH_ALLOW_ENV_FALLBACK: process.env.AUTH_ALLOW_ENV_FALLBACK,
  SMTP_FROM: process.env.SMTP_FROM ?? process.env.EMAIL_FROM,
  AWS_REGION: process.env.AWS_REGION,
  BEDROCK_REGION: process.env.BEDROCK_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
});
