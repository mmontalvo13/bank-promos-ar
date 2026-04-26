import { PromotionSchema, type Promotion } from "@/lib/schemas/promotion";
import { mockPromotions } from "@/lib/mock/promotions";
import { scrapeGaliciaPromotions } from "@/lib/scrapers/galicia";
import { scrapeBbvaPromotions } from "@/lib/scrapers/bbva";
import { scrapeModoPromotions } from "@/lib/scrapers/modo";
import { cached, cachedSWR } from "@/lib/cache";

export type PromotionsQuery = {
  q?: string;
  day?: string;
  category?: string;
  bank?: string;
  network?: string;
};

export async function getPromotions(_query?: PromotionsQuery): Promise<Promotion[]> {
  const base = mockPromotions.map((p) => PromotionSchema.parse(p));
  const withoutMockGalicia = base.filter((p) => p.bank !== "Galicia");
  const withoutMockBbva = withoutMockGalicia.filter((p) => p.bank !== "BBVA");
  const fallback = withoutMockBbva;

  return cachedSWR({
    key: "promotions:v2",
    ttlMs: 30 * 60 * 1000,
    fallback,
    fn: async () => {
    // For now: merge mock data with real scraped data.
    // Strategy:
    // - Use scraped Galicia promos when available
    // - Use scraped BBVA promos when available
    // - Use scraped MODO promos when available
    // - Keep mock promos for other banks
    const [galiciaScrape, bbvaScrape, modoScrape] = await Promise.allSettled([
      cached("scrape:galicia:v2", 30 * 60 * 1000, async () => scrapeGaliciaPromotions()),
      cached("scrape:bbva:v2", 30 * 60 * 1000, async () => scrapeBbvaPromotions({ maxPages: 8 })),
      cached("scrape:modo:v2", 30 * 60 * 1000, async () => scrapeModoPromotions({ maxPages: 10, limit: 100 }))
    ]);

    const g = galiciaScrape.status === "fulfilled" && galiciaScrape.value.ok ? galiciaScrape.value.data : [];
    const b = bbvaScrape.status === "fulfilled" && bbvaScrape.value.ok ? bbvaScrape.value.data : [];
    const m = modoScrape.status === "fulfilled" && modoScrape.value.ok ? modoScrape.value.data : [];

    // Dedupe by id just in case
    const all = [...g, ...b, ...m, ...withoutMockBbva];
    const seen = new Set<string>();
    return all.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    }
  });
}

