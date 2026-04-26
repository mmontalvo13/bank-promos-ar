import * as cheerio from "cheerio";
import { PromotionSchema, type Promotion, type PaymentMethod, type DayOfWeek, type CardNetwork } from "@/lib/schemas/promotion";

export type ScrapeResult<T> =
  | { ok: true; data: T; meta: Record<string, unknown> }
  | { ok: false; error: string; meta: Record<string, unknown> };

const DEFAULT_URL = "https://www.bancogalicia.com/personas/beneficios";
const GALICIA_BFF_BASE = "https://loyalty.bff.bancogalicia.com.ar";
const GALICIA_CATALOG_ENDPOINT = `${GALICIA_BFF_BASE}/api/portal/personalizacion/v1/promociones/catalogo`;
const GALICIA_LOGO_URL = "https://www.galicia.ar/etc.clientlibs/galicia/clientlibs/clientlib-react/resources/logoGalicia.png";
const GALICIA_CATALOG_IMAGE_BASE =
  "https://www.galicia.ar/content/dam/galicia/banco-galicia/personas/promociones/catalogo-de-beneficios/";
const GALICIA_PROMOS_LANDING = "https://www.galicia.ar/personas/buscador-de-promociones";

function resolveGaliciaImageUrl(imagen: unknown): string | null {
  const raw = typeof imagen === "string" ? normalizeText(imagen) : "";
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  // `imagen` comes as a filename like `bowen_180.png`
  return `${GALICIA_CATALOG_IMAGE_BASE}${encodeURIComponent(raw)}`;
}

function normalizeText(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function guessPaymentMethods(text: string): PaymentMethod[] {
  const t = text.toLowerCase();
  const out = new Set<PaymentMethod>();
  if (t.includes("qr") || t.includes("modo") || t.includes("mercado pago") || t.includes("mercadopago")) out.add("QR");
  if (t.includes("contactless") || t.includes("nfc") || t.includes("sin contacto")) out.add("NFC");
  if (t.includes("tarjeta") || t.includes("crédito") || t.includes("debito") || t.includes("débito")) out.add("Physical");
  if (out.size === 0) out.add("Physical");
  return [...out];
}

function guessDays(text: string): DayOfWeek[] {
  const t = text.toLowerCase();
  const out = new Set<DayOfWeek>();
  if (t.includes("lunes")) out.add("monday");
  if (t.includes("martes")) out.add("tuesday");
  if (t.includes("miércoles") || t.includes("miercoles")) out.add("wednesday");
  if (t.includes("jueves")) out.add("thursday");
  if (t.includes("viernes")) out.add("friday");
  if (t.includes("sábado") || t.includes("sabado")) out.add("saturday");
  if (t.includes("domingo")) out.add("sunday");
  return out.size ? [...out] : ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
}

function extractPercent(text: string): number | null {
  const m = text.match(/(\d{1,2})\s?%/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n;
}

function normalizeForMatch(s: string) {
  return normalizeText(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mapGaliciaCategory(subtitulo: string, tipoPromocion?: string): Promotion["category"] {
  const s = normalizeForMatch(subtitulo);
  const t = normalizeForMatch(String(tipoPromocion ?? ""));

  // Observed catalog buckets (Apr 2026): Indumentaria, Vehículos, Librerías, Entretenimiento
  if (s.includes("indumentaria") || s.includes("ropa") || s.includes("calzado")) return "Fashion";
  if (s.includes("supermercado") || s.includes("almacen") || s.includes("almacén") || s.includes("dietetica") || s.includes("dietética"))
    return "Supermarket";
  if (s.includes("combustible") || s.includes("nafta") || s.includes("gasoil") || s.includes("estacion de servicio") || s.includes("estación de servicio"))
    return "Fuel";
  if (s.includes("restaur") || s.includes("gastro") || s.includes("bar") || s.includes("cafeteria") || s.includes("cafetería") || s.includes("delivery"))
    return "Dining";
  if (s.includes("farmacia") || s.includes("perfumer")) return "Pharmacy";
  if (s.includes("electron") || s.includes("tecnologia") || s.includes("tecnología") || s.includes("informatica") || s.includes("informática"))
    return "Electronics";
  if (s.includes("viaje") || s.includes("aerolinea") || s.includes("aerolínea") || s.includes("hotel")) return "Travel";

  // Not a first-class bucket in our schema; closest practical mapping for checkout relevance.
  if (s.includes("libreria") || s.includes("librería") || s.includes("papeleria") || s.includes("papelería")) return "Electronics";

  // Vehicles: not always fuel; keep conservative unless clearly fuel-ish.
  if (s.includes("vehiculo") || s.includes("vehículo") || s.includes("automotor") || s.includes("taller") || s.includes("neumatico") || s.includes("neumático"))
    return "Other";

  // Entertainment is often tickets/shows; not Dining—keep as Other unless we add a dedicated category later.
  if (s.includes("entretenimiento") || s.includes("cine") || s.includes("teatro") || s.includes("show") || s.includes("streaming")) return "Other";

  if (t.includes("combustible")) return "Fuel";

  return "Other";
}

function mapPromotionCategory(p: Pick<Promotion, "bank" | "category">, subtitulo: string, tipoPromocion?: string): Promotion["category"] {
  // Only apply Spanish heuristics to Galicia scraped promos.
  if (p.bank === "Galicia") return mapGaliciaCategory(subtitulo, tipoPromocion);
  return p.category;
}

/**
 * Galicia scraper (v0):
 * - Fetches the public benefits page HTML
 * - Tries to pull promotions from embedded JSON (NEXT_DATA or app state)
 * - Fallback: very naive "card-like" extraction from visible text blocks
 *
 * This is intentionally resilient/iterable: the page is often dynamic, and the real
 * data may live behind XHR endpoints (preferred long-term).
 */
export async function scrapeGaliciaPromotions(opts?: { url?: string }): Promise<ScrapeResult<Promotion[]>> {
  // Preferred: JSON from Galicia loyalty BFF (fast + stable)
  const apiUrl = process.env.GALICIA_PROMOS_API_URL ?? GALICIA_CATALOG_ENDPOINT;
  const htmlUrl = opts?.url ?? process.env.GALICIA_BENEFICIOS_URL ?? DEFAULT_URL;

  try {
    // Fetch all pages from the BFF (it paginates; totalSize is typically ~1000+).
    // Keep a guard to avoid runaway requests.
    const pageSize = 500;
    const maxPages = 10;
    const all: Promotion[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const pagedUrl = apiUrl.includes("?")
        ? `${apiUrl}&page=${page}&pageSize=${pageSize}`
        : `${apiUrl}?page=${page}&pageSize=${pageSize}`;

      const apiRes = await fetch(pagedUrl, {
        headers: {
          accept: "application/json",
          "user-agent":
            "Mozilla/5.0 (compatible; BankPromosAR/0.1; +https://localhost) AppleWebKit/537.36 (KHTML, like Gecko)"
        },
        cache: "no-store"
      });

      if (!apiRes.ok) break;
      const json = (await apiRes.json()) as unknown;
      const promos = extractFromCatalogJson(json);
      all.push(...promos);

      const len =
        typeof json === "object" && json
          ? (((json as any).data?.list ?? (json as any).data?.promociones?.list) as unknown[] | undefined)?.length ?? 0
          : 0;
      if (len < pageSize) break;
    }

    if (all.length) {
      // Dedupe by id across pages
      const seen = new Set<string>();
      const unique = all.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      return { ok: true, data: unique, meta: { mode: "bff_json_paged", apiUrl, pageSize, maxPages, count: unique.length } };
    }

    const res = await fetch(htmlUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; BankPromosAR/0.1; +https://localhost) AppleWebKit/537.36 (KHTML, like Gecko)"
      },
      cache: "no-store"
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `Fetch failed: ${res.status} ${res.statusText}`,
        meta: { url: htmlUrl, status: res.status, apiUrl }
      };
    }

    const html = await res.text();

    // 1) Try NEXT.js payload first.
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch?.[1]) {
      const raw = JSON.parse(nextDataMatch[1]) as unknown;
      // We don't know the exact shape, so return metadata and keep fallback parsing.
      // (Useful for iterating quickly with real page structure.)
      // Continue to fallback extraction below.
      const meta = {
        url: htmlUrl,
        mode: "next_data_present",
        apiUrl,
        nextDataKeys: typeof raw === "object" && raw ? Object.keys(raw as any) : []
      };
      const fallback = extractFromDom(html);
      return { ok: true, data: fallback, meta };
    }

    // 2) Fallback: parse DOM and heuristically extract items.
    const data = extractFromDom(html);
    return { ok: true, data, meta: { url: htmlUrl, mode: "dom_fallback", apiUrl } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
      meta: { url: htmlUrl, apiUrl }
    };
  }
}

function extractFromCatalogJson(json: unknown): Promotion[] {
  // Expected shape (observed):
  // { data: { list: [ { id, promocion, titulo, subtitulo, pagoQR, pagoNFC, contactLess, mediosDePago, leyendaDiasAplicacion, fechaHasta } ] } }
  if (!json || typeof json !== "object") return [];
  const root = json as any;
  // Two observed shapes:
  // - catalogo: { data: { list: [...] } }
  // - list/carrusel: { data: { promociones: { list: [...] } } }
  const list = root?.data?.list ?? root?.data?.promociones?.list;
  if (!Array.isArray(list)) return [];

  const promos: Promotion[] = [];

  for (const item of list) {
    if (!item) continue;

    const promoText = normalizeText(String(item.promocion ?? ""));
    const discountPercent = extractPercent(promoText);
    if (!discountPercent) continue; // keep schema-compatible for now

    const store = normalizeText(String(item.titulo ?? "Galicia"));
    const categoryRaw = normalizeText(String(item.subtitulo ?? ""));
    const tipoPromocion = String(item.tipoPromocion ?? "");

    const paymentMethods = new Set<PaymentMethod>();
    if (item.pagoQR) paymentMethods.add("QR");
    if (item.pagoNFC || item.contactLess) paymentMethods.add("NFC");
    paymentMethods.add("Physical"); // most promos allow card usage; keep as default

    const networks = new Set<CardNetwork>();
    const medios = Array.isArray(item.mediosDePago) ? item.mediosDePago : [];
    for (const m of medios) {
      const name = String(m?.tarjeta ?? "").toLowerCase();
      if (name.includes("visa")) networks.add("Visa");
      if (name.includes("master")) networks.add("Mastercard");
      if (name.includes("american") || name.includes("amex")) networks.add("Amex");
    }
    if (networks.size === 0) {
      // fallback: many promos are Visa+Master
      networks.add("Visa");
      networks.add("Mastercard");
    }

    const daysText = normalizeText(String(item.leyendaDiasAplicacion ?? ""));

    const promo: Promotion = {
      id: `galicia-bff-${String(item.id ?? hashId(promoText))}`,
      title: promoText,
      bank: "Galicia",
      issuerBanks: null,
      imageUrl: resolveGaliciaImageUrl(item.imagen) ?? GALICIA_LOGO_URL,
      category: mapPromotionCategory({ bank: "Galicia", category: "Other" }, categoryRaw, tipoPromocion),
      store,
      cardNetworks: [...networks],
      days: guessDays(daysText),
      paymentMethods: [...paymentMethods],
      discountPercent,
      capArs: null,
      eligibility: {
        segment: item?.modeloAtencion?.nombre ? String(item.modeloAtencion.nombre) : null,
        eminent: typeof item.eminent === "boolean" ? item.eminent : null,
        haberes: typeof item.haberes === "boolean" ? item.haberes : null
      },
      notes: null,
      validFrom: null,
      validTo: item.fechaHasta ? new Date(String(item.fechaHasta)).toISOString() : null,
      source: {
        type: "scraper_placeholder",
        // Human-facing link (bank website), not the JSON endpoint.
        url:
          typeof item.link === "string" && item.link.startsWith("/")
            ? `https://www.galicia.ar${item.link}`
            : GALICIA_PROMOS_LANDING
      }
    };

    const parsed = PromotionSchema.safeParse(promo);
    if (parsed.success) promos.push(parsed.data);
  }

  return promos;
}

function extractFromDom(html: string): Promotion[] {
  const $ = cheerio.load(html);

  // Heuristic: look for repeated blocks containing a percent sign.
  const candidates: { title: string; detail: string }[] = [];

  $("body")
    .find("*")
    .each((_, el) => {
      const text = normalizeText($(el).text());
      if (!text || text.length < 10) return;
      if (!text.includes("%")) return;
      if (text.length > 220) return; // avoid giant containers

      // Split lines-ish
      const parts = text.split("·").map((p) => normalizeText(p)).filter(Boolean);
      const title = parts[0] ?? text;
      candidates.push({ title, detail: text });
    });

  // De-dup by text
  const seen = new Set<string>();
  const uniq = candidates.filter((c) => {
    const key = c.detail.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const promos: Promotion[] = [];
  for (const c of uniq.slice(0, 30)) {
    const pct = extractPercent(c.detail);
    if (!pct) continue;

    const promo: Promotion = {
      id: `galicia-scrape-${hashId(c.detail)}`,
      title: c.title,
      bank: "Galicia",
      issuerBanks: null,
      imageUrl: GALICIA_LOGO_URL,
      category: "Other",
      store: "Beneficios Galicia",
      cardNetworks: ["Visa", "Mastercard", "Amex"],
      days: guessDays(c.detail),
      paymentMethods: guessPaymentMethods(c.detail),
      discountPercent: pct,
      capArs: null,
      eligibility: null,
      notes: c.detail.length > 120 ? c.detail : null,
      validFrom: null,
      validTo: null,
      source: { type: "scraper_placeholder", url: DEFAULT_URL }
    };

    const parsed = PromotionSchema.safeParse(promo);
    if (parsed.success) promos.push(parsed.data);
  }

  return promos;
}

function hashId(s: string) {
  // small stable hash (not crypto) for IDs
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

