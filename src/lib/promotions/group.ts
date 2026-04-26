import type { Promotion } from "@/lib/schemas/promotion";

export type PromotionVariant = Promotion;

export type PromotionGroup = {
  key: string;
  bank: Promotion["bank"];
  store: Promotion["store"];
  titleBase: string;
  category: Promotion["category"];
  cardNetworks: Promotion["cardNetworks"];
  days: Promotion["days"];
  paymentMethods: Promotion["paymentMethods"];
  variants: PromotionVariant[];
};

function titleBase(title: string) {
  // Normalize text so "20% ..." and "25% ..." group together
  // Note: avoid trailing \b after % (space is non-word, so \b fails).
  return title.replace(/\d{1,2}\s?%/g, "%").trim();
}

export function groupPromotions(promotions: Promotion[]): PromotionGroup[] {
  const map = new Map<string, PromotionGroup>();

  for (const p of promotions) {
    const base = titleBase(p.title);
    const key = `${p.bank}||${p.store}||${base}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        bank: p.bank,
        store: p.store,
        titleBase: base,
        category: p.category,
        cardNetworks: p.cardNetworks,
        days: p.days,
        paymentMethods: p.paymentMethods,
        variants: [p]
      });
    } else {
      existing.variants.push(p);
      // keep “best” category if one is not Other
      if (existing.category === "Other" && p.category !== "Other") existing.category = p.category;
      // union networks
      existing.cardNetworks = Array.from(new Set([...existing.cardNetworks, ...p.cardNetworks])) as any;
      // union payment methods/days
      existing.paymentMethods = Array.from(new Set([...existing.paymentMethods, ...p.paymentMethods])) as any;
      existing.days = Array.from(new Set([...existing.days, ...p.days])) as any;
    }
  }

  return [...map.values()].map((g) => ({
    ...g,
    variants: [...g.variants].sort((a, b) => b.discountPercent - a.discountPercent)
  }));
}

