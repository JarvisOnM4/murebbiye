import { describe, it, expect, vi } from "vitest"

// Mock pdf-parse so importing parser.ts does not fail
vi.mock("pdf-parse", () => ({
  default: vi.fn(),
}))

// Mock the types import from prisma (used in curriculum/types.ts)
vi.mock("@prisma/client", () => ({
  DocumentStatus: {},
  LessonTrack: {},
}))

import { parseCurriculumContent } from "@/lib/curriculum/parser"

describe("parseCurriculumContent (markdown)", () => {
  it("should parse markdown into chunks", async () => {
    const markdown = Buffer.from(
      "# Introduction\n\nThis is the first paragraph of the curriculum.\n\n## Section Two\n\nThis is the second section with more content."
    )

    const result = await parseCurriculumContent("markdown", markdown)

    expect(result.text).toBeTruthy()
    expect(result.chunks.length).toBeGreaterThan(0)
    expect(result.chunks[0].ordinal).toBe(1)
    expect(result.chunks[0].content).toBeTruthy()
    expect(result.chunks[0].tokenCount).toBeGreaterThan(0)
  })

  it("should throw on empty markdown content", async () => {
    const emptyBuffer = Buffer.from("")

    await expect(
      parseCurriculumContent("markdown", emptyBuffer)
    ).rejects.toThrow("Markdown parser produced empty content")
  })

  it("should throw on whitespace-only markdown content", async () => {
    const whitespaceBuffer = Buffer.from("   \n\n   \n  ")

    await expect(
      parseCurriculumContent("markdown", whitespaceBuffer)
    ).rejects.toThrow("Markdown parser produced empty content")
  })

  it("should estimate token counts for each chunk", async () => {
    const markdown = Buffer.from(
      "This is a sentence with several words that should produce a token count estimate."
    )

    const result = await parseCurriculumContent("markdown", markdown)

    for (const chunk of result.chunks) {
      expect(chunk.tokenCount).toBeGreaterThanOrEqual(1)
      // Token count should be roughly 1.35x word count
      const wordCount = chunk.content.split(/\s+/).filter(Boolean).length
      expect(chunk.tokenCount).toBe(Math.max(1, Math.ceil(wordCount * 1.35)))
    }
  })

  it("should split long content into multiple chunks", async () => {
    // Generate content long enough to require multiple chunks (>900 chars)
    const longParagraph = "This is a test sentence. ".repeat(80)
    const markdown = Buffer.from(longParagraph)

    const result = await parseCurriculumContent("markdown", markdown)

    expect(result.chunks.length).toBeGreaterThan(1)
    // Ordinals should be sequential
    for (let i = 0; i < result.chunks.length; i++) {
      expect(result.chunks[i].ordinal).toBe(i + 1)
    }
  })
})
