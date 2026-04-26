import { PromotionSchema, type Promotion } from "@/lib/schemas/promotion";
import { mockPromotions } from "@/lib/mock/promotions";
import { scrapeGaliciaPromotions } from "@/lib/scrapers/galicia";
import { scrapeBbvaPromotions } from "@/lib/scrapers/bbva";
import { scrapeModoPromotions } from "@/lib/scrapers/modo";

export type PromotionsQuery = {
  q?: string;
  day?: string;
  category?: string;
  bank?: string;
  network?: string;
};

export async function getPromotions(_query?: PromotionsQuery): Promise<Promotion[]> {
  // For now: merge mock data with real scraped data.
  // Strategy:
  // - Use scraped Galicia promos when available
  // - Use scraped BBVA promos when available
  // - Keep mock promos for other banks
  const base = mockPromotions.map((p) => PromotionSchema.parse(p));

  const galiciaScrape = await scrapeGaliciaPromotions();
  const scrapedGalicia = galiciaScrape.ok ? galiciaScrape.data : [];

  const bbvaScrape = await scrapeBbvaPromotions();
  const scrapedBbva = bbvaScrape.ok ? bbvaScrape.data : [];

  const modoScrape = await scrapeModoPromotions();
  const scrapedModo = modoScrape.ok ? modoScrape.data : [];

  const withoutMockGalicia = base.filter((p) => p.bank !== "Galicia");
  const withoutMockBbva = withoutMockGalicia.filter((p) => p.bank !== "BBVA");

  // Dedupe by id just in case
  const all = [...scrapedGalicia, ...scrapedBbva, ...scrapedModo, ...withoutMockBbva];
  const seen = new Set<string>();
  return all.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

