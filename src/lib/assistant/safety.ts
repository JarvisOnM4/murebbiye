/**
 * Child-safety output filter shared by the non-streaming (service.ts) and
 * streaming (stream.ts) assistant paths.
 */
export const UNSAFE_PATTERNS = [
  /\b(porn|sex(?:ual)?|violence|kill(?:ing)?|suicide|drug|weapon|murder|rape)\b/i,
  /\b(küfür|seks|silah|uyuşturucu|intihar|öldür|tecavüz|şiddet)\b/i,
];

export function isResponseSafe(text: string): boolean {
  return !UNSAFE_PATTERNS.some((p) => p.test(text));
}

export const UNSAFE_FALLBACK_MESSAGE =
  "Bu konuda sana yardımcı olamam. Müfredat konularını sormayı dene!";
