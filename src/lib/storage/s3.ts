import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3"
import path from "path"

const client = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1"
})

function bucketName(): string {
  const name = process.env.S3_BUCKET_NAME
  if (!name) {
    throw new Error("S3_BUCKET_NAME environment variable is not set")
  }
  return name
}

/**
 * Validate and sanitize an S3 key to prevent path traversal.
 *
 * SECURITY: Blocks `..` sequences, absolute paths, and null bytes
 * that could allow accessing objects outside the intended prefix.
 */
function sanitizeKey(key: string): string {
  if (!key || key.includes("\0")) {
    throw new Error("Invalid S3 key: empty or contains null bytes")
  }
  // Normalize path separators and resolve relative segments
  const normalized = path.posix.normalize(key)
  // Block path traversal
  if (normalized.startsWith("/") || normalized.startsWith("..") || normalized.includes("/../")) {
    throw new Error(`Invalid S3 key: path traversal detected in "${key}"`)
  }
  return normalized
}

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const safeKey = sanitizeKey(key)
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: safeKey,
      Body: body,
      ContentType: contentType
    })
  )
}

export async function downloadFromS3(key: string): Promise<Buffer> {
  const safeKey = sanitizeKey(key)
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucketName(),
      Key: safeKey
    })
  )

  if (!response.Body) {
    throw new Error(`S3 object body is empty for key: ${safeKey}`)
  }

  const bytes = await response.Body.transformToByteArray()
  return Buffer.from(bytes)
}
