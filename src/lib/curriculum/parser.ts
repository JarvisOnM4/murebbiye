import MarkdownIt from "markdown-it";
import pdfParse from "pdf-parse";
import type { CurriculumChunkInput, CurriculumSourceType } from "@/lib/curriculum/types";

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false
});

const MAX_CHARS_PER_CHUNK = 900;

function normalizeWhitespace(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtmlTags(input: string) {
  return input
    .replace(/<\/p>/g, "\n\n")
    .replace(/<br\s*\/?\s*>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function estimateTokenCount(content: string) {
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words * 1.35));
}

function splitLongParagraph(paragraph: string) {
  const chunks: string[] = [];
  let current = "";

  const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length <= MAX_CHARS_PER_CHUNK) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current.trim());
      current = "";
    }

    if (sentence.length <= MAX_CHARS_PER_CHUNK) {
      current = sentence;
      continue;
    }

    for (let index = 0; index < sentence.length; index += MAX_CHARS_PER_CHUNK) {
      chunks.push(sentence.slice(index, index + MAX_CHARS_PER_CHUNK).trim());
    }
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks;
}

function chunkText(content: string): CurriculumChunkInput[] {
  const paragraphs = content
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunkTexts: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const paragraphParts =
      paragraph.length <= MAX_CHARS_PER_CHUNK
        ? [paragraph]
        : splitLongParagraph(paragraph);

    for (const part of paragraphParts) {
      const candidate = currentChunk ? `${currentChunk}\n\n${part}` : part;

      if (candidate.length <= MAX_CHARS_PER_CHUNK) {
        currentChunk = candidate;
        continue;
      }

      if (currentChunk) {
        chunkTexts.push(currentChunk.trim());
      }

      currentChunk = part;
    }
  }

  if (currentChunk) {
    chunkTexts.push(currentChunk.trim());
  }

  if (chunkTexts.length === 0 && content) {
    for (let index = 0; index < content.length; index += MAX_CHARS_PER_CHUNK) {
      chunkTexts.push(content.slice(index, index + MAX_CHARS_PER_CHUNK).trim());
    }
  }

  return chunkTexts
    .filter(Boolean)
    .map((text, index) => ({
      ordinal: index + 1,
      content: text,
      tokenCount: estimateTokenCount(text)
    }));
}

async function parseMarkdown(buffer: Buffer) {
  const raw = buffer.toString("utf-8");
  const rendered = markdown.render(raw);
  const text = normalizeWhitespace(stripHtmlTags(rendered));

  if (!text) {
    throw new Error(
      "Markdown parser produced empty content. Ensure the file includes readable text."
    );
  }

  return {
    text,
    chunks: chunkText(text)
  };
}

async function parsePdf(buffer: Buffer) {
  const parsed = await pdfParse(buffer);
  const text = normalizeWhitespace(parsed.text ?? "");

  if (!text) {
    throw new Error(
      "PDF parser produced empty content. Upload a text-based PDF (scanned images are not supported in this pilot)."
    );
  }

  return {
    text,
    chunks: chunkText(text)
  };
}

export async function parseCurriculumContent(sourceType: CurriculumSourceType, buffer: Buffer) {
  if (sourceType === "markdown") {
    return parseMarkdown(buffer);
  }

  return parsePdf(buffer);
}
