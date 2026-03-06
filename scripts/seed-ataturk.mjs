/**
 * Seed Atatürk supplementary curriculum content into the database.
 * Run: node scripts/seed-ataturk.mjs
 *
 * Sources: Research from 5 books (Nutuk, Kinross, Ortaylı, Başbuğ, Akman)
 * and verified historical sources.
 */

import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

const prisma = new PrismaClient();

const DOCUMENT_TITLE = "Atatürk — Çocuklar İçin Tarih ve Liderlik";
const UPLOADER_ID_QUERY = { role: "ADMIN" };

const CHUNKS = [
  // Chunk 0: Biyografi — Çocukluk ve Gençlik
  `Mustafa Kemal Atatürk 1881 yılında Selanik'te doğdu. Küçüklüğünden beri bağımsız ve meraklı bir çocuktu. Annesinin isteğine rağmen gizlice askeri okul sınavına girdi ve kazandı. Okumayı çok seven bir öğrenciydi — hayatı boyunca kitaplarla iç içe yaşadı ve toplam 14 kitap yazdı. Manastır Askeri Lisesi'ni ikinci olarak bitirdi (1898), Harbiye'den 1902'de, Harp Akademisi'nden 1905'te kurmay yüzbaşı olarak mezun oldu.

Atatürk'ün çocukluğundan öğrenebileceğimiz en önemli şey: merak ve azim. Ailesi istemese bile hedefinin peşinden gitti. Okumaya olan tutkusu onu diğer liderlerden ayırdı — reformlarının temelinde derin bilgi vardı.`,

  // Chunk 1: Çanakkale Savaşı
  `Çanakkale Savaşı (1915) Atatürk'ün askeri dehasını dünyaya gösterdiği savaştır. 19. Tümen komutanı olarak görev aldı. Müttefik kuvvetler 25 Nisan 1915'te karaya çıktığında, Alman komutan Liman von Sanders'ten emir beklemeden kendi inisiyatifiyle harekete geçti.

Ünlü emri: "Ben size taarruz emretmiyorum, ölmeyi emrediyorum. Biz ölünceye kadar geçecek zaman zarfında yerimize başka kuvvetler ve kumandanlar gelebilir."

Anafartalar zaferinde (Ağustos 1915) İngilizlerin son çıkarma girişimini püskürttü. Savaş sırasında şarapnel parçası göğsüne isabet etti ama cebindeki saat hayatını kurtardı. Çanakkale, Atatürk'ün cesaret, inisiyatif ve stratejik düşünce gücünü gösteren bir dönüm noktasıdır.`,

  // Chunk 2: Kurtuluş Savaşı
  `19 Mayıs 1919'da Samsun'a çıkışı, Kurtuluş Savaşı'nın başlangıcıdır. Amasya Genelgesi (22 Haziran 1919) bağımsızlık mücadelesini yazılı olarak başlatan ilk belgedir. Erzurum ve Sivas Kongreleri ona meşru bir otorite kazandırdı.

Önemli savaşlar:
- Birinci İnönü (Ocak 1921): İsmet Bey komutasında savunma zaferi
- İkinci İnönü (Mart-Nisan 1921): 9 gün süren çatışmada Yunan kuvvetleri geri çekildi
- Sakarya Meydan Muharebesi (Ağustos-Eylül 1921): 21 gün, 100 km'lik cephede savaş. Yunan ilerleyişi Ankara kapısında durduruldu. Bu zafer ona "Mareşal" rütbesi ve "Gazi" unvanını kazandırdı
- Büyük Taarruz (26 Ağustos - 18 Eylül 1922): Kocatepe'den yönetilen saldırıda 14 günde Yunan ordusu İzmir'e kadar kovalandı. 9 Eylül 1922'de işgal sona erdi.

Başarısının üç sırrı: sezgi, ihtiyat ve inceleme. Hiçbir şeyi şansa bırakmadı.`,

  // Chunk 3: Cumhuriyet ve Reformlar
  `29 Ekim 1923'te Cumhuriyet ilan edildi. Atatürk sadece bir savaş kahramanı değil, aynı zamanda büyük bir reformcuydu. Temel reformları:

Laiklik: Halifelik kaldırıldı (1924), din ve devlet işleri ayrıldı, laik mahkemeler kuruldu.
Harf Devrimi (1928): Arap alfabesinden Latin alfabesine geçildi. Okuma yazma oranı 1923'te %9'dan 1938'de %33'e yükseldi.
Kadın Hakları: Evlilikte eşit haklar, çok eşlilik yasaklandı. 1934'te kadınlara seçme ve seçilme hakkı — Fransa'dan (1944) ve İtalya'dan (1946) önce!
Eğitim Devrimi: İlkokul öğrenci sayısı 342.000'den 765.000'e çıktı (%224 artış). Ortaokul 12.5 kat, lise 17 kat arttı.
Hukuk: İsviçre Medeni Kanunu örnek alındı, modern takvim ve ölçü birimleri kabul edildi.

Altı Ok (Altı İlke): Cumhuriyetçilik, Milliyetçilik, Halkçılık, Devletçilik, Laiklik ve İnkılapçılık.`,

  // Chunk 4: Dış Politika ve Barış
  `Atatürk'ün dış politika ilkesi: "Yurtta sulh, cihanda sulh" (İlk kez 20 Nisan 1931). Bu, maceraperestliği ve yayılmacılığı reddeden bir anlayıştır.

Lozan Antlaşması (24 Temmuz 1923): Sevr Antlaşması'nın yerine geçti. İsmet İnönü 8 ay boyunca müzakere etti. Müttefikler Kürt özerkliği ve Ermeni toprak taleplerinden vazgeçti. Kapitülasyonlar kaldırıldı. Türkiye'nin maliyesi ve ordusu üzerinde hiçbir kontrol kalmadı. Bugünkü sınırlar esasen bu antlaşmayla çizildi.

Atatürk, Kurtuluş Savaşı'ndan sonra bir daha askeri güç kullanmadı. Döneminin güçlü adamları arasında bu tutum gerçekten istisnai ve takdire değerdi. Askeri zafer ile diplomatik çerçeveyi birlikte düşünürdü — savaş her zaman Lozan'a giden yoldu, sadece cephe değil.`,

  // Chunk 5: Kişilik ve İnsan Yönü
  `Atatürk'ün kişiliği hakkında tarihçiler şunları söyler:
- İlber Ortaylı: "Kendine güvenen, gerçek amaçlarını gizleyen, ne kibirli ne de yumuşak"
- İlker Başbuğ: "Her şeyden önce yorulmak bilmez bir savaşçı; işine sıkı sıkıya bağlı"
- Kinross: Kitaplarla dolu kütüphanesinde gece gündüz saatler geçirirdi

Evlat edindiği çocuklar arasında en ünlüsü Sabiha Gökçen'dir — dünyanın ilk kadın savaş pilotu oldu. Ona "Gökçen" (gökyüzünden gelen) adını, o daha havacılığı seçmeden verdi. Afet İnan'ı da evlat edindi; İnan önemli bir tarihçi oldu. Bu baba içgüdüsü, eğitim reformlarına da yansıdı.

Latife Hanım ile 1923'te evlendi. O eğitimli, Fransızca ve İngilizce bilen, güçlü iradeli bir kadındı. Evlilikleri iki buçuk yıl sürdü. Boşanmalarına rağmen ona gül göndermeye devam etti.

10 Kasım 1938'de saat 09:05'te Dolmabahçe Sarayı'nda hayatını kaybetti. 57 yaşındaydı.`,

  // Chunk 6: Osmanlı'dan Cumhuriyet'e — Tarihsel Bağlam
  `Atatürk'ü anlamak için Osmanlı İmparatorluğu'nun son dönemini bilmek gerekir. 1800'lerden itibaren imparatorluk geriliyordu — Rusya ve Avusturya ile askeri olarak yarışamaz hale gelmişti.

Tanzimat Dönemi (1839-1876): Reformcu devlet adamları modern mahkemeler, yeni okullar ve Prusya modeli askerlik sistemi getirdi. Ancak tutucu din adamlarının direnciyle karşılaştı ve devlet büyük borçlara girdi.

Balkan Savaşları (1912-1913): Osmanlı, Avrupa topraklarının %83'ünü ve Avrupa nüfusunun %69'unu kaybetti. Atatürk'ün doğduğu Selanik, Yunanistan'a geçti.

Birinci Dünya Savaşı: İttihat ve Terakki'nin Almanya ile ittifakı felaket oldu. Mondros Mütarekesi (1918) ve ardından Sevr Antlaşması (1920) Anadolu'yu bölmeyi öneriyordu: Yunan kontrolünde Batı Anadolu, bağımsız Ermenistan, özerk Kürdistan, İtalyan ve Fransız bölgeleri...

İşte Atatürk bu kaotik ortamda ortaya çıktı ve bir ulusun kaderini değiştirdi.`,

  // Chunk 7: Atatürk'ten Öğreneceklerimiz
  `Atatürk'ün hayatından çıkarabileceğimiz dersler:

1. Bilgi güçtür: Atatürk 14 kitap yazdı ve kütüphanesinde saatler geçirdi. Reformlarının arkasında derin araştırma vardı. Bilmeden değiştiremezsin.

2. Cesaret ve inisiyatif: Çanakkale'de emir beklemeden harekete geçti. Doğru zamanda doğru kararı vermek cesaret ister.

3. Sabır ve strateji: Büyük Taarruz için bir yıldan fazla bekledi. Siyasi baskılara rağmen erken saldırmadı — güçlenmeyi tercih etti.

4. Barışı sevmek: "Yurtta sulh, cihanda sulh" — savaşı kazandıktan sonra bir daha askeri güç kullanmadı. Gerçek güç, gücünü kontrol edebilmektir.

5. Eğitime inanmak: Okuma yazma oranını %9'dan %33'e çıkardı. Kadınlara seçme hakkı verdi. Bir ülkenin geleceği eğitimli insanlarla kurulur.

6. Eleştirel düşünmek: Hiçbir lider mükemmel değildir. Atatürk büyük işler başardı ama tartışmalı kararlar da aldı. Önemli olan, tarihi sorgulayarak öğrenmek.

"Atatürk, ne Kemalist mitolojinin yarı-tanrısıydı ne de en sert eleştirmenlerinin tiranlığı. Tarihin nadir başardığı bir şeyi gerçekleştirdi: bir ulusu yok olmaktan kurtardı ve ona yeni bir gelecek verdi."`,

  // Chunk 8: Nutuk — Atatürk'ün Kendi Ağzından
  `Nutuk (1927), Atatürk'ün 6 gün boyunca toplam 36 saat süren tarihi konuşmasıdır. 15-20 Ekim 1927 tarihleri arasında TBMM'de okudu. 1919-1924 dönemini kendi bakış açısından anlattı.

Gençliğe Hitabe (Nutuk'tan): "İlk vazifen, Türk istiklalini, Türk Cumhuriyetini, ilelebet muhafaza ve müdafaa etmektir. Mevcudiyetinin ve istikbalinin yegane temeli budur."

Nutuk, Atatürk'ün zihnini ve Türk ulusal kimliğinin nasıl inşa edildiğini anlamak için vazgeçilmez bir eserdir. Ancak tarafsız bir tarih kitabı değil, bir savunma ve anlatıdır. Bazı önemli isimlerin (Karabekir, Orbay, Halide Edib) rollerini küçümser. Yine de Türkiye'nin resmi ulusal anlatısının temelini oluşturdu.`,
];

async function main() {
  // Find an admin user to use as uploader
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (!admin) {
    console.error("No admin user found. Run `npm run db:seed` first.");
    process.exit(1);
  }

  const documentId = `ataturk-${randomUUID().slice(0, 8)}`;
  const fullContent = CHUNKS.join("\n\n---\n\n");
  const checksum = createHash("sha256").update(fullContent).digest("hex");

  // Check if Atatürk document already exists
  const existing = await prisma.curriculumDocument.findFirst({
    where: { title: DOCUMENT_TITLE },
  });

  if (existing) {
    console.log(`Atatürk document already exists (id: ${existing.id}). Updating chunks...`);

    await prisma.$transaction(async (tx) => {
      await tx.curriculumChunk.deleteMany({ where: { documentId: existing.id } });
      await tx.curriculumChunk.createMany({
        data: CHUNKS.map((content, i) => ({
          documentId: existing.id,
          ordinal: i,
          content,
          tokenCount: Math.ceil(content.length / 4),
        })),
      });
      await tx.curriculumDocument.update({
        where: { id: existing.id },
        data: { status: "READY", checksum, updatedAt: new Date() },
      });
    });

    console.log(`Updated ${CHUNKS.length} chunks for document ${existing.id}`);
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.curriculumDocument.create({
        data: {
          id: documentId,
          uploaderId: admin.id,
          title: DOCUMENT_TITLE,
          originalName: "ataturk-supplementary.md",
          mimeType: "text/markdown",
          storageKey: `supplementary/ataturk-${documentId}.md`,
          sourceLanguage: "tr",
          track: "AI_MODULE",
          checksum,
          status: "READY",
        },
      });

      await tx.curriculumChunk.createMany({
        data: CHUNKS.map((content, i) => ({
          documentId,
          ordinal: i,
          content,
          tokenCount: Math.ceil(content.length / 4),
        })),
      });
    });

    console.log(`Created Atatürk document (id: ${documentId}) with ${CHUNKS.length} chunks`);
  }

  console.log("Done! Atatürk content is now available in the assistant.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
