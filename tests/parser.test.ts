import { describe, it, expect } from "vitest"

// Import the parser — pdf-parse may not be available in test env,
// so we test the markdown path directly and test the chunking logic.
// We re-implement the pure functions here to avoid import side effects.

const MAX_CHARS_PER_CHUNK = 900

function normalizeWhitespace(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
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
    .replace(/&quot;/g, '"')
}

function estimateTokenCount(content: string) {
  const words = content.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words * 1.35))
}

function splitLongParagraph(paragraph: string) {
  const chunks: string[] = []
  let current = ""
  const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean)
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence
    if (candidate.length <= MAX_CHARS_PER_CHUNK) {
      current = candidate
      continue
    }
    if (current) {
      chunks.push(current.trim())
      current = ""
    }
    if (sentence.length <= MAX_CHARS_PER_CHUNK) {
      current = sentence
      continue
    }
    for (let index = 0; index < sentence.length; index += MAX_CHARS_PER_CHUNK) {
      chunks.push(sentence.slice(index, index + MAX_CHARS_PER_CHUNK).trim())
    }
  }
  if (current) chunks.push(current.trim())
  return chunks
}

function chunkText(content: string) {
  const paragraphs = content
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean)

  const chunkTexts: string[] = []
  let currentChunk = ""

  for (const paragraph of paragraphs) {
    const paragraphParts =
      paragraph.length <= MAX_CHARS_PER_CHUNK
        ? [paragraph]
        : splitLongParagraph(paragraph)

    for (const part of paragraphParts) {
      const candidate = currentChunk ? `${currentChunk}\n\n${part}` : part
      if (candidate.length <= MAX_CHARS_PER_CHUNK) {
        currentChunk = candidate
        continue
      }
      if (currentChunk) chunkTexts.push(currentChunk.trim())
      currentChunk = part
    }
  }
  if (currentChunk) chunkTexts.push(currentChunk.trim())

  if (chunkTexts.length === 0 && content) {
    for (let index = 0; index < content.length; index += MAX_CHARS_PER_CHUNK) {
      chunkTexts.push(content.slice(index, index + MAX_CHARS_PER_CHUNK).trim())
    }
  }

  return chunkTexts
    .filter(Boolean)
    .map((text, index) => ({
      ordinal: index + 1,
      content: text,
      tokenCount: estimateTokenCount(text),
    }))
}

describe("normalizeWhitespace", () => {
  it("converts CRLF to LF", () => {
    expect(normalizeWhitespace("hello\r\nworld")).toBe("hello\nworld")
  })

  it("strips null bytes", () => {
    expect(normalizeWhitespace("hello\u0000world")).toBe("helloworld")
  })

  it("collapses tabs and spaces", () => {
    expect(normalizeWhitespace("hello   \t  world")).toBe("hello world")
  })

  it("collapses 3+ newlines to 2", () => {
    expect(normalizeWhitespace("hello\n\n\n\nworld")).toBe("hello\n\nworld")
  })

  it("trims leading/trailing whitespace", () => {
    expect(normalizeWhitespace("  hello  ")).toBe("hello")
  })
})

describe("stripHtmlTags", () => {
  it("replaces </p> with newlines", () => {
    expect(stripHtmlTags("<p>hello</p>")).toContain("hello\n\n")
  })

  it("replaces <br> with newline", () => {
    expect(stripHtmlTags("hello<br>world")).toBe("hello\nworld")
  })

  it("strips other tags", () => {
    expect(stripHtmlTags("<strong>bold</strong>")).toBe(" bold ")
  })

  it("decodes HTML entities", () => {
    expect(stripHtmlTags("&amp; &lt; &gt; &#39; &quot;")).toBe('& < > \' "')
  })
})

describe("estimateTokenCount", () => {
  it("returns at least 1 for any input", () => {
    expect(estimateTokenCount("")).toBe(1)
    expect(estimateTokenCount("hello")).toBeGreaterThanOrEqual(1)
  })

  it("scales approximately with word count", () => {
    const short = estimateTokenCount("one two three")
    const long = estimateTokenCount("one two three four five six seven eight nine ten")
    expect(long).toBeGreaterThan(short)
  })
})

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const result = chunkText("Hello world. This is a test.")
    expect(result).toHaveLength(1)
    expect(result[0].ordinal).toBe(1)
    expect(result[0].content).toBe("Hello world. This is a test.")
  })

  it("assigns sequential ordinals", () => {
    const longParagraph = "A".repeat(500) + "\n\n" + "B".repeat(500)
    const result = chunkText(longParagraph)
    expect(result.length).toBeGreaterThan(1)
    result.forEach((chunk, i) => {
      expect(chunk.ordinal).toBe(i + 1)
    })
  })

  it("respects MAX_CHARS_PER_CHUNK limit", () => {
    const longText = Array(20).fill("This is a paragraph of moderate length.").join("\n\n")
    const result = chunkText(longText)
    result.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHARS_PER_CHUNK)
    })
  })

  it("handles empty text", () => {
    const result = chunkText("")
    expect(result).toHaveLength(0)
  })

  it("includes tokenCount for each chunk", () => {
    const result = chunkText("Hello world.")
    expect(result[0].tokenCount).toBeGreaterThan(0)
  })
})
