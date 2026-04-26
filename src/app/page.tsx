"use client";

import { useEffect, useMemo, useState } from "react";
import type { Category, Bank, CardNetwork, DayOfWeek, Promotion } from "@/lib/schemas/promotion";
import { CategorySchema, BankSchema, CardNetworkSchema, DayOfWeekSchema } from "@/lib/schemas/promotion";
import { CategoryNav } from "@/components/navigation/CategoryNav";
import { PromotionCard } from "@/components/promotions/PromotionCard";
import { SmartSuggestion } from "@/components/promotions/SmartSuggestion";
import { getTodayKey } from "@/lib/date";
import { Search, SlidersHorizontal, Wallet } from "lucide-react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet/useWallet";
import { groupPromotions } from "@/lib/promotions/group";
import { PromotionGroupCard } from "@/components/promotions/PromotionGroupCard";

const categories = CategorySchema.options;
const banks = BankSchema.options;
const networks = CardNetworkSchema.options;
const days = DayOfWeekSchema.options;

function dayLabel(day: DayOfWeek) {
  const map: Record<DayOfWeek, string> = {
    monday: "Lun",
    tuesday: "Mar",
    wednesday: "Mié",
    thursday: "Jue",
    friday: "Vie",
    saturday: "Sáb",
    sunday: "Dom"
  };
  return map[day];
}

export default function HomePage() {
  const { wallet } = useWallet();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | "All">("All");
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | "Any">(getTodayKey());
  const [selectedBank, setSelectedBank] = useState<Bank | "Any">("Any");
  const [selectedNetwork, setSelectedNetwork] = useState<CardNetwork | "Any">("Any");
  const [showFilters, setShowFilters] = useState(false);

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loadingPromotions, setLoadingPromotions] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingPromotions(true);
        const res = await fetch("/api/promotions", { cache: "no-store" });
        const json = (await res.json()) as { promotions: Promotion[] };
        if (cancelled) return;
        setPromotions(Array.isArray(json.promotions) ? json.promotions : []);
      } catch {
        if (cancelled) return;
        setPromotions([]);
      } finally {
        if (cancelled) return;
        setLoadingPromotions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return promotions.filter((p) => {
      if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
      if (selectedDay !== "Any" && !p.days.includes(selectedDay)) return false;
      if (selectedBank !== "Any" && p.bank !== selectedBank) return false;
      if (selectedNetwork !== "Any" && !p.cardNetworks.includes(selectedNetwork)) return false;
      if (!q) return true;
      const hay = `${p.title} ${p.bank} ${p.store} ${p.category} ${p.cardNetworks.join(" ")} ${p.paymentMethods.join(" ")}`
        .toLowerCase()
        .includes(q);
      return hay;
    });
  }, [promotions, query, selectedCategory, selectedDay, selectedBank, selectedNetwork]);

  const grouped = useMemo(() => groupPromotions(filtered), [filtered]);

  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-extrabold tracking-tight text-neutral-950">Bank Promos AR</div>
            <div className="text-xs font-medium text-neutral-600">Elegí la mejor forma de pago en segundos</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/wallet"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900"
            >
              <Wallet className="h-4 w-4" />
              Mi billetera
            </Link>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[240px_1fr] lg:gap-6 lg:py-6">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <CategoryNav categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-neutral-900 text-white">
                <Search className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <label className="block text-xs font-semibold text-neutral-700">Buscar</label>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ej: YPF, Carrefour, QR, Visa…"
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 outline-none ring-neutral-900/10 placeholder:text-neutral-400 focus:ring-4"
                />
              </div>
            </div>

            {showFilters ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value as DayOfWeek | "Any")}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900"
                >
                  {(["Any", ...days] as const).map((d) => (
                    <option key={d} value={d}>
                      {d === "Any" ? "Cualquier día" : dayLabel(d)}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value as Bank | "Any")}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900"
                >
                  {(["Any", ...banks] as const).map((b) => (
                    <option key={b} value={b}>
                      {b === "Any" ? "Cualquier banco" : b}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value as CardNetwork | "Any")}
                  className="col-span-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900"
                >
                  {(["Any", ...networks] as const).map((n) => (
                    <option key={n} value={n}>
                      {n === "Any" ? "Cualquier red (Visa/Mastercard…)" : n}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {loadingPromotions ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm font-semibold text-neutral-700 shadow-sm">
              Cargando promociones…
            </div>
          ) : (
            <SmartSuggestion promotions={promotions as Promotion[]} wallet={wallet} />
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold text-neutral-950">Promociones</div>
            <div className="text-xs font-semibold text-neutral-600">{grouped.length} resultados</div>
          </div>

          <div className="space-y-3">
            {grouped.map((g) =>
              g.variants.length > 1 ? <PromotionGroupCard key={g.key} group={g} /> : <PromotionCard key={g.variants[0].id} promotion={g.variants[0]} />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

