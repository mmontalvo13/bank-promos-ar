import { PromotionSchema, type Promotion, type DayOfWeek, type PaymentMethod, type CardNetwork } from "@/lib/schemas/promotion";

export type ScrapeResult<T> =
  | { ok: true; data: T; meta: Record<string, unknown> }
  | { ok: false; error: string; meta: Record<string, unknown> };

const DEFAULT_URL = "https://www.modo.com.ar/promos";
const DEFAULT_API_BASE = "https://promoshub.modo.com.ar/promos/api/rewards";

type ModoSlotsResponse = {
  data?: {
    cards?: Array<{
      id: string;
      slug?: string | null;
      title?: string | null;
      short_description?: string | null;
      where?: string | null;
      search_tags?: string | null;
      start_date?: string | null;
      stop_date?: string | null;
      days_of_week?: string | null;
      payment_flow?: string | null;
      content?: {
        row?: Array<{ text?: string | null }> | null;
        image?: {
          primary_image?: string | null;
          secondary_image?: string | null;
        } | null;
      } | null;
    }>;
  };
};

function tryExtractEnvObjectFromHtml(html: string): Record<string, string> | null {
  // MODO's promos site is a Next.js app that embeds env in a streamed payload:
  // window['__ENV'] = {\"KEY\":\"VALUE\", ...}
  const m = html.match(/window\['__ENV'\]\s*=\s*(\{[\s\S]*?\})/);
  if (!m?.[1]) return null;

  const raw = m[1];
  // This JSON is inside a JS string, so quotes are escaped.
  const jsonLike = raw.replace(/\\"/g, '"');
  try {
    const parsed = JSON.parse(jsonLike) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * MODO scraper (v0):
 * The `/promos` page is rendered by a Next.js app and does not expose a stable public
 * HTML list of promotions. We can, however, extract the environment-configured backend
 * hosts from the streamed HTML payload to guide future API-based scraping.
 */
export async function scrapeModoPromotions(opts?: { url?: string; maxPages?: number; limit?: number }): Promise<ScrapeResult<Promotion[]>> {
  const url = opts?.url ?? process.env.MODO_PROMOS_URL ?? DEFAULT_URL;

  try {
    // First: fetch page HTML to extract env and locate API base.
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
    const env = tryExtractEnvObjectFromHtml(html);

    const promoHubBase = env?.NEXT_PUBLIC_PROMOHUB_URL ?? null;
    const apiBase = promoHubBase ? `${promoHubBase.replace(/\/+$/, "")}/promos/api/rewards` : DEFAULT_API_BASE;

    const limit = Math.min(Math.max(opts?.limit ?? 100, 10), 200);
    const maxPages = Math.min(Math.max(opts?.maxPages ?? 10, 1), 200);

    // Map issuing bank name -> public bank promotions URL (human-facing, not JSON).
    const banksUrl = `${apiBase}/banks?source=MBW`;
    const banksRes = await fetch(banksUrl, { headers: { "user-agent": "Mozilla/5.0", accept: "application/json" }, cache: "no-store" });
    const bankPromoUrlByName = new Map<string, string>();
    if (banksRes.ok) {
      const banks = (await banksRes.json()) as Array<{ name?: string; promotion_url?: string }>;
      for (const b of banks) {
        const name = typeof b?.name === "string" ? normalizeText(b.name) : "";
        const promo = typeof b?.promotion_url === "string" ? normalizeText(b.promotion_url) : "";
        if (name && promo.startsWith("http")) bankPromoUrlByName.set(normalizeForMatch(name), promo);
      }
    }

    const allCards: NonNullable<ModoSlotsResponse["data"]>["cards"] = [];
    for (let page = 0; page < maxPages; page++) {
      const slotsUrl = `${apiBase}/slots?source=MBW&limit=${limit}&page=${page}`;
      const slotsRes = await fetch(slotsUrl, {
        headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
        cache: "no-store"
      });
      if (!slotsRes.ok) {
        return {
          ok: false,
          error: `Fetch slots failed: ${slotsRes.status} ${slotsRes.statusText}`,
          meta: { url, slotsUrl, status: slotsRes.status, promoHubBase, env, page, limit, maxPages }
        };
      }

      const json = (await slotsRes.json()) as ModoSlotsResponse;
      const cards = json.data?.cards ?? [];
      allCards.push(...cards);
      if (cards.length < limit) break;
    }

    const promos: Promotion[] = [];
    for (const c of allCards ?? []) {
      const row = (c.content?.row ?? []).map((r) => (r?.text ?? "").trim()).filter(Boolean);
      const haystack = [c.title, c.short_description, c.search_tags, c.where, ...row].filter(Boolean).join(" ");

      const pct = extractPercent(haystack);
      if (!pct) continue; // keep schema strict (requires a % today)

      const capArs = extractCapArs(row);
      const issuerBanks = extractIssuerBanks({ row, searchTags: c.search_tags, title: c.title, shortDescription: c.short_description });

      const store = row[0] || c.where || "Comercios adheridos";
      const title = row.find((t) => t.includes("%")) || c.short_description || c.title || `${pct}% con MODO`;
      const imageUrl = c.content?.image?.primary_image ?? c.content?.image?.secondary_image ?? null;
      const publicPromoUrl =
        issuerBanks.map((b) => bankPromoUrlByName.get(normalizeForMatch(b))).find(Boolean) ?? "https://www.modo.com.ar/promos";

      const promo: Promotion = {
        id: `modo-${c.slug ?? c.id}`,
        title: normalizeText(title),
        bank: "MODO",
        issuerBanks: issuerBanks.length ? issuerBanks : null,
        imageUrl,
        category: mapModoCategory(haystack),
        store: normalizeText(store),
        cardNetworks: guessCardNetworks(haystack),
        days: mapModoDays(c.days_of_week),
        paymentMethods: guessPaymentMethods(haystack),
        discountPercent: pct,
        capArs,
        eligibility: null,
        notes: c.search_tags ? `Tags: ${normalizeText(c.search_tags)}` : null,
        validFrom: c.start_date ?? null,
        validTo: c.stop_date ?? null,
        // Human-facing link (bank website / MODO promos), not the JSON slots endpoint.
        source: { type: "scraper_placeholder", url: publicPromoUrl }
      };

      const parsed = PromotionSchema.safeParse(promo);
      if (parsed.success) promos.push(parsed.data);
    }

    // Dedupe by id (paging can overlap)
    const seen = new Set<string>();
    const unique = promos.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    return {
      ok: true,
      data: unique,
      meta: {
        url,
        slotsUrlTemplate: `${apiBase}/slots?source=MBW&limit=${limit}&page={page}`,
        apiBase,
        promoHubBase,
        extractedEnv: env ? { promoHubBase: env.NEXT_PUBLIC_PROMOHUB_URL ?? null } : null,
        limit,
        maxPages,
        cards: allCards.length,
        count: unique.length
      }
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error", meta: { url } };
  }
}

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

function extractCapArs(row: string[]): number | null {
  // MODO rows sometimes contain a cap like "25000" or "$ 25.000"
  for (const s of row) {
    const t = normalizeForMatch(s);
    const m = t.match(/(?:\\$\\s*)?([0-9]{1,3}(?:[\\.,][0-9]{3})+|[0-9]{3,7})/);
    if (!m?.[1]) continue;
    const n = Number(m[1].replace(/\./g, "").replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

function mapModoDays(daysOfWeek?: string | null): DayOfWeek[] {
  // Observed values: "X" (unknown/all)
  if (!daysOfWeek || daysOfWeek === "X") {
    return ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  }
  const t = daysOfWeek.toLowerCase();
  const out = new Set<DayOfWeek>();
  if (t.includes("l")) out.add("monday");
  if (t.includes("m")) out.add("tuesday");
  if (t.includes("x")) out.add("wednesday");
  if (t.includes("j")) out.add("thursday");
  if (t.includes("v")) out.add("friday");
  if (t.includes("s")) out.add("saturday");
  if (t.includes("d")) out.add("sunday");
  return out.size ? [...out] : ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
}

function guessPaymentMethods(text: string): PaymentMethod[] {
  const t = normalizeForMatch(text);
  const out = new Set<PaymentMethod>();
  // MODO promos are wallet-first; default to QR
  out.add("QR");
  if (t.includes("sin contacto") || t.includes("contactless") || t.includes("nfc")) out.add("NFC");
  if (t.includes("tarjeta") || t.includes("credito") || t.includes("debito")) out.add("Physical");
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

function mapModoCategory(text: string): Promotion["category"] {
  const t = normalizeForMatch(text);
  if (t.includes("super") || t.includes("coto") || t.includes("jumbo") || t.includes("disco") || t.includes("dia ")) return "Supermarket";
  if (t.includes("combustible") || t.includes("ypf") || t.includes("shell") || t.includes("axion")) return "Fuel";
  if (t.includes("restaur") || t.includes("gastro") || t.includes("burger") || t.includes("kansas") || t.includes("delivery")) return "Dining";
  if (t.includes("farmacia")) return "Pharmacy";
  if (t.includes("electron") || t.includes("tecnolog") || t.includes("informat")) return "Electronics";
  if (t.includes("indumentaria") || t.includes("ropa") || t.includes("calzado") || t.includes("zapat")) return "Fashion";
  if (t.includes("viaje") || t.includes("hotel") || t.includes("aerolinea") || t.includes("aerolínea")) return "Travel";
  return "Other";
}

const KNOWN_BANKS = [
  "BBVA",
  "Galicia",
  "Santander",
  "Banco Nación",
  "Nación",
  "Provincia",
  "Credicoop",
  "Comafi",
  "Supervielle",
  "Macro",
  "ICBC",
  "Ciudad",
  "Patagonia",
  "Hipotecario",
  "Brubank",
  "Ualá",
  "NaranjaX",
  "Naranja X"
];

function extractIssuerBanks(input: { row: string[]; searchTags?: string | null; title?: string | null; shortDescription?: string | null }): string[] {
  const out = new Map<string, string>();
  const add = (s: string) => {
    const v = normalizeText(s);
    if (!v) return;
    out.set(normalizeForMatch(v), v);
  };

  // 1) Often the last "pill" in the row is the issuing bank name (e.g. "Comafi", "Supervielle").
  if (input.row.length) {
    const tail = input.row[input.row.length - 1];
    if (tail && !tail.includes("%") && tail.length <= 40 && !/^\d+$/.test(tail)) add(tail);
  }

  // 2) Search tags sometimes include bank names, comma-separated.
  // Keep only items that look like an issuing bank (heuristics + allowlist).
  const tags = input.searchTags ? input.searchTags.split(",").map((s) => normalizeText(s)) : [];
  for (const t of tags) {
    if (!t) continue;
    const n = normalizeForMatch(t);
    const looksLikeBank =
      n.includes("banco ") ||
      n.startsWith("banco") ||
      n === "bbva" ||
      n === "galicia" ||
      n === "santander" ||
      n === "credicoop" ||
      n === "comafi" ||
      n === "supervielle" ||
      n === "macro" ||
      n === "icbc" ||
      n === "ciudad" ||
      n === "patagonia" ||
      n === "hipotecario" ||
      n === "brubank" ||
      n === "uala" ||
      n === "ualá" ||
      n === "naranja" ||
      n === "naranjax" ||
      n === "naranja x" ||
      n === "nacion" ||
      n === "banco nacion" ||
      n === "banco nación";
    if (looksLikeBank) add(t);
  }

  // 3) If nothing found, do a conservative scan against a small known list.
  if (out.size === 0) {
    const hay = normalizeForMatch([input.title, input.shortDescription, input.searchTags, ...input.row].filter(Boolean).join(" "));
    for (const b of KNOWN_BANKS) {
      const n = normalizeForMatch(b);
      if (n && hay.includes(n)) add(b);
    }
  }

  // Remove noise / non-banks
  const banned = new Set([
    "modo",
    "reintegro",
    "promocion",
    "promoción",
    "presencial",
    "virtual",
    "qr",
    "cuotas",
    "financiación",
    "exclusivo con",
    "comercios adheridos",
    "bancos adheridos"
  ]);
  const cleaned = [...out.values()].filter((s) => !banned.has(normalizeForMatch(s)) && s.length >= 3);

  // Normalize a couple common aliases
  return cleaned
    .map((s) => {
      const n = normalizeForMatch(s);
      if (n === "nacion" || n === "banco nacion") return "Banco Nación";
      if (n === "naranja x") return "NaranjaX";
      if (n.startsWith("banco ")) {
        const rest = s.slice("banco ".length);
        return `Banco ${rest.replace(/\s+/g, " ").trim()}`.replace(/\b\w/g, (c) => c.toUpperCase());
      }
      if (n === "macro") return "Banco Macro";
      if (n === "comafi") return "Banco Comafi";
      if (n === "ciudad") return "Banco Ciudad";
      return s;
    })
    .filter((v, i, arr) => arr.findIndex((x) => normalizeForMatch(x) === normalizeForMatch(v)) === i);
}

