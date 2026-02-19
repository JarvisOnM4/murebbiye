import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3"

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

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: body,
      ContentType: contentType
    })
  )
}

export async function downloadFromS3(key: string): Promise<Buffer> {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucketName(),
      Key: key
    })
  )

  if (!response.Body) {
    throw new Error(`S3 object body is empty for key: ${key}`)
  }

  const bytes = await response.Body.transformToByteArray()
  return Buffer.from(bytes)
}
