import * as cheerio from "cheerio";
import { PromotionSchema, type Promotion, type PaymentMethod, type DayOfWeek, type CardNetwork } from "@/lib/schemas/promotion";

export type ScrapeResult<T> =
  | { ok: true; data: T; meta: Record<string, unknown> }
  | { ok: false; error: string; meta: Record<string, unknown> };

// NOTE: `https://www.bbva.com.ar/beneficios/beneficios` currently serves a merchant/comercios landing (not consumer promos)
// and returns 404 for the exact path the user pasted. The public marketing page below contains concrete reintegro examples.
const DEFAULT_CONSUMER_URL = "https://www.bbva.com.ar/personas/productos/programa-beneficios.html";

function normalizeText(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeForMatch(s: string) {
  return normalizeText(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractPercent(text: string): number | null {
  const m = text.match(/(\d{1,2})\s?%/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n;
}

function guessDays(text: string): DayOfWeek[] {
  const t = normalizeForMatch(text);
  if (t.includes("todos los dias") || t.includes("todos los días")) {
    return ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  }

  const out = new Set<DayOfWeek>();
  if (t.includes("lunes")) out.add("monday");
  if (t.includes("martes")) out.add("tuesday");
  if (t.includes("miercoles") || t.includes("miércoles")) out.add("wednesday");
  if (t.includes("jueves")) out.add("thursday");
  if (t.includes("viernes")) out.add("friday");
  if (t.includes("sabado") || t.includes("sábado")) out.add("saturday");
  if (t.includes("domingo")) out.add("sunday");
  return out.size ? [...out] : ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
}

function guessPaymentMethods(text: string): PaymentMethod[] {
  const t = normalizeForMatch(text);
  const out = new Set<PaymentMethod>();
  if (t.includes("qr") || t.includes("mercado pago") || t.includes("mercadopago") || t.includes("modo")) out.add("QR");
  if (t.includes("sin contacto") || t.includes("contactless") || t.includes("nfc")) out.add("NFC");
  out.add("Physical");
  return [...out];
}

function guessCardNetworks(text: string): CardNetwork[] {
  const t = normalizeForMatch(text);
  const out = new Set<CardNetwork>();
  if (t.includes("visa")) out.add("Visa");
  if (t.includes("master")) out.add("Mastercard");
  if (t.includes("american express") || t.includes("amex")) out.add("Amex");
  if (out.size === 0) {
    out.add("Visa");
    out.add("Mastercard");
  }
  return [...out];
}

function mapBbvaCategory(text: string): Promotion["category"] {
  const t = normalizeForMatch(text);
  if (t.includes("supermercado") || t.includes("coto") || t.includes("jumbo") || t.includes("disco") || t.includes("dia %") || t.includes("día %") || t.includes(" vea"))
    return "Supermarket";
  if (t.includes("combustible") || t.includes("ypf") || t.includes("shell") || t.includes("axion")) return "Fuel";
  if (t.includes("restaur") || t.includes("gastro") || t.includes("burger") || t.includes("kansas") || t.includes("dandy") || t.includes("delivery") || t.includes("pedidosya"))
    return "Dining";
  if (t.includes("farmacia") || t.includes("drugstore")) return "Pharmacy";
  if (t.includes("electron") || t.includes("tecnologia") || t.includes("informatica")) return "Electronics";
  if (t.includes("indumentaria") || t.includes("ropa") || t.includes("calzado") || t.includes("adidas") || t.includes("nike")) return "Fashion";
  if (t.includes("viaje") || t.includes("aerolinea") || t.includes("hotel") || t.includes("millas")) return "Travel";
  return "Other";
}

function extractStoreFromDescription(desc: string, cardTitle: string) {
  const d = normalizeText(desc);
  const t = normalizeText(cardTitle);

  // Prefer explicit "en ..." clause when it's short enough to be a store line.
  const en = d.match(/\ben\s+([^\.]+)\./i);
  if (en?.[1]) {
    const chunk = normalizeText(en[1]);
    if (chunk.length <= 120) return chunk;
  }

  // Fallback: use card title if it looks like a program/brand bucket
  if (t && t.length <= 80) return t;

  return "BBVA (beneficios)";
}

function isMerchantLanding(url: string, html: string) {
  const t = normalizeForMatch(html);
  const u = normalizeForMatch(url);

  // The `/beneficios/*` microsite is oriented to merchants/comercios.
  if (u.includes("bbva.com.ar/beneficios")) {
    return t.includes("suipportalmarcas") || t.includes("portal de marcas") || t.includes("comercios");
  }

  return false;
}

function hashId(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/**
 * BBVA scraper (v0):
 * - Fetch a public HTML page with concrete benefit copy
 * - Extract lines mentioning `%` (reintegros/descuentos)
 * - Map into our Promotion schema (best-effort)
 */
export async function scrapeBbvaPromotions(opts?: { url?: string }): Promise<ScrapeResult<Promotion[]>> {
  const url = opts?.url ?? process.env.BBVA_BENEFICIOS_URL ?? DEFAULT_CONSUMER_URL;

  try {
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; BankPromosAR/0.1; +https://localhost) AppleWebKit/537.36 (KHTML, like Gecko)",
        accept: "text/html,application/xhtml+xml"
      },
      cache: "no-store"
    });

    if (!res.ok) {
      return { ok: false, error: `Fetch failed: ${res.status} ${res.statusText}`, meta: { url, status: res.status } };
    }

    const html = await res.text();
    if (isMerchantLanding(url, html)) {
      return {
        ok: false,
        error:
          "This URL looks like a merchant/comercios landing, not consumer promotions. Try BBVA_BENEFICIOS_URL pointing to a public benefits page with reintegro/discount copy.",
        meta: { url, mode: "merchant_landing_detected" }
      };
    }

    const $ = cheerio.load(html);

    const promos: Promotion[] = [];

    $("li.card").each((_, li) => {
      const root = $(li);
      const cardTitle = normalizeText(root.find(".card__title").first().text());
      const desc = normalizeText(root.find(".card__body.rte").first().text());
      if (!desc || !desc.includes("%")) return;

      const pct = extractPercent(desc);
      if (!pct) return;

      const store = extractStoreFromDescription(desc, cardTitle);
      const title = normalizeText(desc);

      const promo: Promotion = {
        id: `bbva-scrape-${hashId(`${cardTitle}|${desc}`)}`,
        title,
        bank: "BBVA",
        issuerBanks: null,
        imageUrl: null,
        category: mapBbvaCategory(desc),
        store,
        cardNetworks: guessCardNetworks(desc),
        days: guessDays(desc),
        paymentMethods: guessPaymentMethods(desc),
        discountPercent: pct,
        capArs: null,
        eligibility: null,
        notes: null,
        validFrom: null,
        validTo: null,
        source: { type: "scraper_placeholder", url }
      };

      const parsed = PromotionSchema.safeParse(promo);
      if (parsed.success) promos.push(parsed.data);
    });

    return { ok: true, data: promos, meta: { url, mode: "html_cards", count: promos.length } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error", meta: { url } };
  }
}
