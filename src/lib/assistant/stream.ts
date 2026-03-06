import { listReadyCurriculumChunks } from "@/lib/curriculum/repository";
import type { CurriculumChunkContext } from "@/lib/curriculum/types";
import type { ScopeConstrainedReplyInput } from "@/lib/assistant/types";

type ScoredChunk = {
  chunk: CurriculumChunkContext;
  score: number;
  matchedTokens: number;
};

const MAX_CHUNK_SCAN = 160;
const MAX_CONTEXT_CHUNKS = 5;
const MIN_MATCHED_TOKENS = 1;
const MIN_SCOPE_SCORE = 3;

const STOP_WORDS = new Set([
  "the", "and", "for", "from", "that", "this", "with", "have", "your",
  "what", "when", "where", "which", "about", "into", "a", "an", "to",
  "of", "in", "on", "is", "are", "be", "can", "will", "how", "why",
  "bu", "ve", "icin", "ile", "bir", "ne", "neden", "nasil", "hangi",
  "olan", "gibi", "ama", "daha", "mi", "mu", "midir", "kadar", "gore",
  "gorev", "ders", "lesson", "track",
]);

const DEFAULT_SUGGESTIONS = [
  "Prompt nedir?",
  "Chatbot'a nasıl soru sorulur?",
  "Atatürk kimdir?",
  "Yapay zeka yanılabilir mi?",
];

const SYSTEM_PROMPT = `Sen Mürebbiye — 8-14 yaş çocukları için yapay zeka eğitim asistanı.

KESİN KURALLAR:
- MAX 3-4 cümle. Kısa, net, sohbet gibi. Asla uzun paragraflar yazma.
- Bir ana fikir ver, bir örnek ver, bir sonraki soru öner. Bu kadar.
- Müfredat dışı konulara cevap verme — nazikçe konuyu geri getir.
- Türkçe yaz, İngilizce terimleri parantez içinde ekle.
- Sıcak ve meraklı ol ama kısa kes. Çocuğun dikkatini kaybetme.
- Her cevabın sonunda çocuğu yönlendiren tek bir soru sor.
- Emoji az kullan, sadece vurgu için.`;

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c");
}

function clip(value: string, maxLength = 180) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3).trim()}...`;
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function buildBigrams(tokens: string[]) {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

function scoreChunk(
  questionTokens: string[],
  questionBigrams: string[],
  chunk: CurriculumChunkContext
) {
  const haystack = normalizeText(chunk.content);
  let matchedTokens = 0;
  for (const token of questionTokens) {
    if (haystack.includes(token)) matchedTokens += 1;
  }
  let bigramHits = 0;
  for (const bigram of questionBigrams) {
    if (haystack.includes(bigram)) bigramHits += 1;
  }
  return { chunk, score: matchedTokens * 3 + bigramHits * 2, matchedTokens };
}

function stripStructural(text: string): string {
  return text
    .replace(
      /^#{1,4}\s+(Unite|Ders|Gorev|Konu Ozeti|Isinma Etkinligi|Hikaye|Aciklama|Uygulama|Bagimsiz Gorev|Dusunme ve Tartisma|Anahtar Kavramlar|Fissizden|Turkce'de Prompt).*$/gm,
      ""
    )
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/\(\d+\s*dakika\)/g, "")
    .replace(/^(Gorev|Adim|Ornek)\s*\d*\s*[—:\-]\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildContext(chunks: ScoredChunk[]): string {
  return chunks
    .map((c) => stripStructural(c.chunk.content))
    .filter((text) => text.length > 20)
    .join("\n\n---\n\n");
}

const TOPIC_QUESTIONS: Record<string, string[]> = {
  prompt: [
    "Kötü prompt ile iyi prompt farkı ne?",
    "Bana bir prompt örneği göster",
    "Prompt yazarken nelere dikkat etmeliyim?",
    "Adım adım prompt nasıl oluşturulur?",
    "Prompt mühendisliği nedir?",
  ],
  chatbot: [
    "Elif'in chatbot hikayesini anlat",
    "Chatbot nasıl düşünür?",
    "Chatbot ile insan arasındaki fark ne?",
    "Chatbot'a nasıl daha iyi soru sorulur?",
    "Chatbot'lar nasıl öğrenir?",
  ],
  halusinasyon: [
    "Yapay zeka neden bazen yanlış söyler?",
    "Chatbot'un söylediğini nasıl kontrol ederiz?",
    "Halüsinasyon nedir ve neden olur?",
    "Yapay zekanın verdiği bilgiye güvenilir mi?",
  ],
  robot: [
    "Taklit Robotu oyunu nasıl oynanır?",
    "Robot neden belirsiz komutu anlamaz?",
    "Robot ile yapay zeka aynı şey mi?",
  ],
  deprem: [
    "Deprem hakkında adım adım prompt nasıl yazılır?",
    "Yapay zeka doğal afetlerde nasıl kullanılır?",
  ],
  rol: [
    "Chatbot'a rol vermek ne demek?",
    "Yapay zekaya 'öğretmen gibi davran' desek ne olur?",
    "Rol vermenin faydası ne?",
  ],
  elestir: [
    "Yapay zekanın söylediğini nasıl kontrol ederiz?",
    "Eleştirel düşünme nedir?",
    "Bilgiyi doğrulamak neden önemli?",
  ],
  yemek: [
    "Elif chatbot'tan nasıl tarif aldı?",
    "Yapay zekadan tarif istemek iyi bir fikir mi?",
  ],
  ataturk: [
    "Atatürk Çanakkale'de ne yaptı?",
    "Atatürk'ün reformları nelerdir?",
    "Atatürk nasıl bir liderdi?",
    "Atatürk'ün eğitim anlayışı neydi?",
    "Atatürk ve bilim ilişkisi nasıldı?",
  ],
  cumhuriyet: [
    "Cumhuriyet nasıl kuruldu?",
    "Atatürk'ün dış politika ilkesi nedir?",
    "Cumhuriyetin ilk yıllarında neler değişti?",
    "Laiklik ne demek?",
  ],
  kurtulus: [
    "Kurtuluş Savaşı nasıl kazanıldı?",
    "Büyük Taarruz'u anlat",
    "Sakarya Meydan Muharebesi nedir?",
    "İstiklal Savaşı'nda kadınların rolü neydi?",
  ],
  nutuk: [
    "Nutuk nedir?",
    "Gençliğe Hitabe ne söyler?",
    "Nutuk neden önemli bir eser?",
  ],
  yapay_zeka: [
    "Yapay zeka ile neler yapılabilir?",
    "Yapay zeka nasıl çalışır?",
    "Yapay zeka tehlikeli mi?",
    "Yapay zeka sanat yapabilir mi?",
    "Yapay zeka gelecekte hangi meslekleri değiştirir?",
    "Yapay zeka ve etik nedir?",
    "Makine öğrenmesi ne demek?",
    "Derin öğrenme nedir?",
  ],
  gunluk: [
    "Yapay zeka günlük hayatımızda nerede var?",
    "Telefonumdaki yapay zeka örnekleri neler?",
    "Sosyal medya yapay zekayı nasıl kullanıyor?",
    "Oyunlardaki yapay zeka nasıl çalışır?",
    "Siri ve Alexa nasıl anlıyor bizi?",
  ],
  guvenlik: [
    "İnternette güvende kalmak için ne yapmalıyız?",
    "Yapay zeka ile sahte haberler nasıl yapılır?",
    "Deepfake nedir?",
    "Kişisel verileri neden korumalıyız?",
  ],
};

const ALL_SUGGESTIONS = Object.values(TOPIC_QUESTIONS).flat();

function buildSuggestions(
  question: string,
  ranked: ScoredChunk[],
  exclude: string[] = []
): string[] {
  const excludeSet = new Set(exclude);
  const suggestions: string[] = [];
  const normalizedQ = normalizeText(question);

  // Phase 1: Context-relevant suggestions from matched chunks
  for (const item of ranked.slice(0, 5)) {
    const normalized = normalizeText(item.chunk.content);
    for (const [keyword, questions] of Object.entries(TOPIC_QUESTIONS)) {
      if (normalized.includes(keyword) && !normalizedQ.includes(keyword)) {
        for (const q of questions) {
          if (suggestions.length >= 3) break;
          if (!excludeSet.has(q) && !suggestions.includes(q)) {
            suggestions.push(q);
          }
        }
      }
    }
    if (suggestions.length >= 3) break;
  }

  // Phase 2: Fill from full pool (shuffled), excluding used ones
  if (suggestions.length < 3) {
    const available = ALL_SUGGESTIONS.filter(
      (s) => !excludeSet.has(s) && !suggestions.includes(s)
    );
    // Fisher-Yates shuffle
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    for (const s of available) {
      if (suggestions.length >= 3) break;
      suggestions.push(s);
    }
  }

  return suggestions.slice(0, 3);
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function streamWithScopeGuard(
  input: ScopeConstrainedReplyInput
): Promise<ReadableStream<Uint8Array>> {
  const allSources = await listReadyCurriculumChunks(MAX_CHUNK_SCAN);

  if (allSources.length === 0) {
    throw new Error("No READY curriculum chunks found.");
  }

  const trackSources = allSources.filter((chunk) => chunk.track === input.track);
  const sources = trackSources.length > 0 ? trackSources : allSources;
  const questionTokens = [...new Set(tokenize(input.question))];
  const questionBigrams = buildBigrams(questionTokens);

  const ranked = sources
    .map((chunk) => scoreChunk(questionTokens, questionBigrams, chunk))
    .sort((a, b) => b.score - a.score || b.chunk.chunkOrdinal - a.chunk.chunkOrdinal);

  const best = ranked[0];
  const matchedTokenCount = best?.matchedTokens ?? 0;
  const isInScope = Boolean(
    best && best.matchedTokens >= MIN_MATCHED_TOKENS && best.score >= MIN_SCOPE_SCORE
  );

  const encoder = new TextEncoder();

  // Out of scope — return immediately as SSE
  if (!isInScope || questionTokens.length === 0) {
    const outOfScopeAnswer =
      "Bu konuda henüz bir dersimiz yok ama aşağıdaki konuları birlikte keşfedebiliriz!";

    return new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(sseEvent("text", { token: outOfScopeAnswer }))
        );
        controller.enqueue(
          encoder.encode(
            sseEvent("done", {
              status: "OUT_OF_SCOPE",
              suggestions: DEFAULT_SUGGESTIONS,
              guardrail: {
                sourcePolicy: "curriculum_only",
                track: input.track,
                matchedTokenCount,
                scannedChunks: sources.length,
              },
            })
          )
        );
        controller.close();
      },
    });
  }

  // In scope — stream from OpenRouter
  const topChunks = ranked.filter((c) => c.score > 0).slice(0, MAX_CONTEXT_CHUNKS);
  const context = buildContext(topChunks);
  const suggestions = buildSuggestions(input.question, ranked, input.excludeSuggestions);

  const references = topChunks.slice(0, 3).map((item) => ({
    documentId: item.chunk.documentId,
    documentTitle: item.chunk.documentTitle,
    chunkOrdinal: item.chunk.chunkOrdinal,
    excerpt: clip(item.chunk.content),
    track: item.chunk.track,
    score: item.score,
  }));

  const guardrail = {
    sourcePolicy: "curriculum_only",
    track: input.track,
    matchedTokenCount,
    scannedChunks: sources.length,
  };

  const baseUrl =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  const model =
    process.env.PRIMARY_MODEL_NAME ?? "qwen/qwen3-235b-a22b-2507";

  const llmResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `MÜFREDAT İÇERİĞİ:\n${context}\n\n---\n\nÖĞRENCİ SORUSU: ${input.question}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!llmResponse.ok || !llmResponse.body) {
    // Fallback: send excerpt as non-streamed answer
    const fallback = topChunks
      .slice(0, 2)
      .map((c) => clip(c.chunk.content, 300))
      .join("\n\n");

    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseEvent("text", { token: fallback })));
        controller.enqueue(
          encoder.encode(
            sseEvent("done", {
              status: "IN_SCOPE",
              suggestions,
              references,
              guardrail,
            })
          )
        );
        controller.close();
      },
    });
  }

  const reader = llmResponse.body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async pull(controller) {
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Flush any remaining buffer
          if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const line of lines) {
              const token = extractToken(line);
              if (token) {
                controller.enqueue(
                  encoder.encode(sseEvent("text", { token }))
                );
              }
            }
          }

          controller.enqueue(
            encoder.encode(
              sseEvent("done", {
                status: "IN_SCOPE",
                suggestions,
                references,
                guardrail,
              })
            )
          );
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        // Keep the last incomplete line in buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const token = extractToken(line);
          if (token) {
            controller.enqueue(
              encoder.encode(sseEvent("text", { token }))
            );
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

function extractToken(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data: ")) return null;

  const data = trimmed.slice(6);
  if (data === "[DONE]") return null;

  try {
    const parsed = JSON.parse(data);
    const delta = parsed.choices?.[0]?.delta;
    if (delta?.content) return delta.content;
    // Handle reasoning models
    if (delta?.reasoning_content) return delta.reasoning_content;
  } catch {
    // Skip malformed lines
  }
  return null;
}
