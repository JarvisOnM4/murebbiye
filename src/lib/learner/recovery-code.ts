import { prisma } from "@/lib/prisma";

/**
 * 80 child-friendly Turkish adjectives (colors, traits, nature).
 */
const ADJECTIVES = [
  "MAVI", "KIRMIZI", "YESIL", "SARI", "TURUNCU", "MOR", "PEMBE", "BEYAZ",
  "SIYAH", "GRI", "ALTIN", "GUMUS", "LACIVERT", "TURKUAZ", "BORDO", "EFLATUN",
  "CESUR", "GUZEL", "TATLI", "AKILLI", "HIZLI", "GUCLU", "MUTLU", "NEŞELI",
  "PARLAK", "SICAK", "SERIN", "DERIN", "YUKSEK", "UZUN", "KISA", "GENIS",
  "TEMIZ", "YUMUSAK", "SERT", "HAFIF", "AGIR", "INCE", "KALIN", "BUYUK",
  "KUCUK", "YENI", "ESKI", "TAZE", "SOGUK", "ILIK", "KOYU", "ACIK",
  "SAYDAM", "DOLU", "BOS", "DUZ", "SIVRI", "YUVARLAK", "UZUN", "DAR",
  "GIZLI", "ACIK", "KAPALI", "SESSIZ", "GURULTULU", "YAVAS", "ZARIF", "NAZIK",
  "KIBAR", "CIDDI", "KOMIK", "EGLENCELI", "SEVIMLI", "SAHANE", "HARIKA", "MUHTESEM",
  "BUYULU", "SIHIRLI", "YILDIZLI", "GUNESLI", "RUZGARLI", "YAGMURLU", "KARLI", "BULUTLU",
];

/**
 * 80 child-friendly Turkish nouns (animals, nature, space).
 */
const NOUNS = [
  "KEDI", "KOPEK", "KUS", "BALIK", "TAVSAN", "KAPLUMBAGA", "KELEBEK", "ARICI",
  "KARINCA", "ASLAN", "KAPLAN", "FIL", "ZURAFA", "PANDA", "PENGUEN", "YUNUS",
  "BALINA", "AHTAPOT", "DENIZATI", "YILDIZBALIK", "KARTAL", "BAYKUS", "PAPAGAN", "FLAMINGO",
  "KURT", "TILKI", "AYICIK", "SINCAP", "KIRPI", "KOALA", "KUNDUZ", "TAVUSKUSU",
  "AGAC", "CICEK", "YAPRAK", "ORMAN", "DENIZ", "NEHIR", "GOL", "DAG",
  "TEPE", "VADI", "ADA", "BULUT", "YILDIZ", "AY", "GUNES", "GEZEGEN",
  "GALAKSI", "KUYRUKLU", "METEOR", "UZAY", "ROKET", "UYDU", "TELESKOP", "PUSULA",
  "HARITA", "KITAP", "KALEM", "FIRCA", "PALET", "NOTA", "MELODI", "RITIM",
  "DALGIC", "PILOT", "KAPTAN", "KASIF", "MUCIT", "SANATCI", "BILGIN", "USTA",
  "ELMAS", "YAKUT", "ZUMRUT", "SAFIR", "INCI", "MERCAN", "KEHRIBAR", "KRISTAL",
];

const MAX_NUMBER = 999;
const MAX_RETRIES = 10;

function randomInt(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % (max + 1);
}

function generateCandidate(): string {
  const adj = ADJECTIVES[randomInt(ADJECTIVES.length - 1)];
  const noun = NOUNS[randomInt(NOUNS.length - 1)];
  const num = String(randomInt(MAX_NUMBER)).padStart(3, "0");
  return `${adj}-${noun}-${num}`;
}

/**
 * Generate a unique recovery code in SIFAT-ISIM-NNN format.
 * Retries up to MAX_RETRIES times to ensure uniqueness.
 */
export async function generateUniqueRecoveryCode(): Promise<string> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const code = generateCandidate();
    const existing = await prisma.user.findUnique({
      where: { recoveryCode: code },
      select: { id: true },
    });
    if (!existing) {
      return code;
    }
  }
  throw new Error("Failed to generate unique recovery code after retries.");
}
