import { PromotionSchema, type Promotion, type PaymentMethod, type DayOfWeek, type CardNetwork } from "@/lib/schemas/promotion";

export type ScrapeResult<T> =
  | { ok: true; data: T; meta: Record<string, unknown> }
  | { ok: false; error: string; meta: Record<string, unknown> };

// BBVA "beneficios" are served by a public API used by their benefits SPA.
// It provides a list endpoint and a detail endpoint by ID.
const BBVA_API_BASE = "https://go.bbva.com.ar/willgo/fgo/API/v3";
const BBVA_LIST_ENDPOINT = `${BBVA_API_BASE}/communications`;
const BBVA_DETAIL_ENDPOINT = `${BBVA_API_BASE}/communication`;

// Human-facing page (SPA). We'll link here with `?id=` so "Ver promo" goes to BBVA website.
const BBVA_BENEFICIO_PAGE = "https://www.bbva.com.ar/beneficios/beneficio.html";

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
 * BBVA scraper (v1):
 * - Use BBVA public benefits API (list + detail by id)
 * - Map each benefit into our Promotion schema (best-effort)
 */
export async function scrapeBbvaPromotions(opts?: { maxPages?: number; pageSize?: number }): Promise<ScrapeResult<Promotion[]>> {
  const maxPages = Math.min(Math.max(opts?.maxPages ?? 10, 1), 100);

  try {
    const promos: Promotion[] = [];
    const seenIds = new Set<string>();

    for (let pager = 0; pager < maxPages; pager++) {
      // BBVA pagination uses `pager` (0-based). Other params appear to be ignored.
      const listUrl = `${BBVA_LIST_ENDPOINT}?pager=${pager}`;
      const listRes = await fetch(listUrl, {
        headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
        cache: "no-store"
      });
      if (!listRes.ok) {
        return { ok: false, error: `Fetch failed: ${listRes.status} ${listRes.statusText}`, meta: { listUrl, status: listRes.status } };
      }

      const listJson = (await listRes.json()) as any;
      const items: any[] = Array.isArray(listJson?.data) ? listJson.data : [];
      if (items.length === 0) break;
      const newIdsThisPage = items
        .map((x) => String(x?.id ?? ""))
        .filter((id) => id && !seenIds.has(id));
      // Some deployments appear to ignore pagination params and always return the first page.
      // If we see no new ids, stop early to avoid needless requests.
      if (pager > 0 && newIdsThisPage.length === 0) break;

      for (const it of items) {
        const id = String(it?.id ?? "");
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        const detailUrl = `${BBVA_DETAIL_ENDPOINT}/${encodeURIComponent(id)}`;
        const detailRes = await fetch(detailUrl, {
          headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
          cache: "no-store"
        });
        if (!detailRes.ok) continue;

        const detailJson = (await detailRes.json()) as any;
        const data = detailJson?.data;
        if (!data) continue;

        const header = normalizeText(String(data.cabecera ?? ""));
        const pct = extractPercent(header) ?? extractPercent(String(data.basesCondiciones ?? "")) ?? extractPercent(String(data.vigencia ?? ""));
        if (!pct) continue; // keep schema compatible

        const store = normalizeText(header.replace(/\s*\d{1,2}\s?%\s*/g, "").trim()) || "BBVA (beneficios)";
        const notes = normalizeText(String(data.basesCondiciones ?? "")) || null;
        const imageUrl = typeof data.imagen === "string" && data.imagen.startsWith("http") ? data.imagen : null;

        const beneficios = Array.isArray(data.beneficios) ? data.beneficios : [];
        const tope = beneficios[0]?.tope;
        const capArs = typeof tope === "number" && Number.isFinite(tope) && tope > 0 ? Math.trunc(tope) : null;

        const daysText = normalizeText(String(data.diasPromo ?? "")) || (notes ?? "");

        const promo: Promotion = {
          id: `bbva-api-${id}`,
          title: header || `${pct}% BBVA`,
          bank: "BBVA",
          issuerBanks: null,
          imageUrl,
          category: mapBbvaCategory([header, notes ?? ""].join(" ")),
          store,
          cardNetworks: guessCardNetworks([String(data.grupoTarjeta ?? ""), notes ?? ""].join(" ")),
          days: guessDays(daysText),
          paymentMethods: guessPaymentMethods([String(data.grupoTarjeta ?? ""), notes ?? ""].join(" ")),
          discountPercent: pct,
          capArs,
          eligibility: null,
          notes,
          validFrom: null,
          validTo: null,
          // Human-facing BBVA page:
          source: { type: "scraper_placeholder", url: `${BBVA_BENEFICIO_PAGE}?id=${encodeURIComponent(id)}` }
        };

        const parsed = PromotionSchema.safeParse(promo);
        if (parsed.success) promos.push(parsed.data);
      }

      // API seems to return a fixed page size (usually 20). Stop only when empty or no new ids.
    }

    return {
      ok: true,
      data: promos,
      meta: { mode: "bbva_api_v3", listEndpoint: BBVA_LIST_ENDPOINT, pagerParam: true, maxPages, count: promos.length }
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error", meta: { listEndpoint: BBVA_LIST_ENDPOINT } };
  }
}
