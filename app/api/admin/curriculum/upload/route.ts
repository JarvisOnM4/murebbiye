import { LessonTrack, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { ingestCurriculum } from "@/lib/curriculum/service";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const uploadSchema = z.object({
  track: z.nativeEnum(LessonTrack).default(LessonTrack.ENGLISH),
  sourceLanguage: z.enum(["tr", "en"]).default("en"),
  title: z.string().trim().min(1).max(140).optional()
});

function detectSourceType(file: File) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".md") || fileName.endsWith(".markdown")) {
    return "markdown" as const;
  }

  if (fileName.endsWith(".pdf")) {
    return "pdf" as const;
  }

  if (file.type === "text/markdown" || file.type === "text/plain") {
    return "markdown" as const;
  }

  if (file.type === "application/pdf") {
    return "pdf" as const;
  }

  return null;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json(
      {
        error: "Unauthorized"
      },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const fileField = formData.get("file");

  if (!(fileField instanceof File)) {
    return NextResponse.json(
      {
        errors: ["Please select a file to upload."]
      },
      { status: 400 }
    );
  }

  if (fileField.size === 0) {
    return NextResponse.json(
      {
        errors: ["Uploaded file is empty. Provide a Markdown or PDF file with content."]
      },
      { status: 400 }
    );
  }

  const maxBytes = env.UPLOAD_MAX_MB * 1024 * 1024;

  if (fileField.size > maxBytes) {
    return NextResponse.json(
      {
        errors: [`File exceeds ${env.UPLOAD_MAX_MB} MB limit. Split the content and retry.`]
      },
      { status: 400 }
    );
  }

  const sourceType = detectSourceType(fileField);

  if (!sourceType) {
    return NextResponse.json(
      {
        errors: ["Only Markdown (.md) and PDF (.pdf) files are supported."]
      },
      { status: 400 }
    );
  }

  const parsedMeta = uploadSchema.safeParse({
    track: formData.get("track") ?? undefined,
    sourceLanguage: formData.get("sourceLanguage") ?? undefined,
    title: formData.get("title") ?? undefined
  });

  if (!parsedMeta.success) {
    return NextResponse.json(
      {
        errors: parsedMeta.error.issues.map((issue) => issue.message)
      },
      { status: 400 }
    );
  }

  const fileBuffer = Buffer.from(await fileField.arrayBuffer());

  const ingestion = await ingestCurriculum({
    uploaderId: session.user.id,
    title: parsedMeta.data.title || fileField.name,
    originalName: fileField.name,
    mimeType: fileField.type || (sourceType === "pdf" ? "application/pdf" : "text/markdown"),
    sourceLanguage: parsedMeta.data.sourceLanguage,
    sourceType,
    track: parsedMeta.data.track,
    buffer: fileBuffer
  });

  if (ingestion.errors.length > 0) {
    return NextResponse.json(ingestion, { status: 422 });
  }

  return NextResponse.json(ingestion, { status: 200 });
}
