import type { Promotion } from "@/lib/schemas/promotion";
import { getTodayKey, formatDayEs } from "@/lib/date";
import { Sparkles } from "lucide-react";
import { PromotionCard } from "./PromotionCard";
import type { MyWallet } from "@/lib/schemas/wallet";

function score(p: Promotion, wallet?: MyWallet) {
  // Base: prioritize higher percent, then higher cap (if any).
  let s = p.discountPercent * 1000 + (p.capArs ?? 0);

  // Bonus if user actually has what the promo needs.
  if (wallet) {
    const bankOk = wallet.banks.length === 0 ? 0 : wallet.banks.includes(p.bank) ? 1 : -1;
    const ownedForBank = wallet.bankCards?.[p.bank] ?? [];
    const networkOk =
      ownedForBank.length === 0 ? 0 : p.cardNetworks.some((n) => ownedForBank.includes(n as never)) ? 1 : -1;
    const paymentOk =
      wallet.paymentMethods.length === 0
        ? 0
        : p.paymentMethods.some((m) => wallet.paymentMethods.includes(m))
          ? 1
          : -1;

    s += bankOk * 25000;
    s += networkOk * 15000;
    s += paymentOk * 15000;
  }

  return s;
}

export function SmartSuggestion({ promotions, wallet }: { promotions: Promotion[]; wallet?: MyWallet }) {
  const today = getTodayKey();
  const todays = promotions.filter((p) => p.days.includes(today));
  const best = [...todays].sort((a, b) => score(b, wallet) - score(a, wallet)).slice(0, 1)[0];

  if (!best) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-neutral-900 p-2 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-sm font-bold text-neutral-900">Mejor para hoy</div>
        </div>
        <p className="mt-3 text-sm text-neutral-700">
          No encontramos promos para <span className="font-semibold">{formatDayEs(today)}</span> en el mock actual.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="rounded-xl bg-neutral-900 p-2 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-extrabold text-neutral-950">Mejores descuentos para hoy</div>
          <div className="text-xs font-medium text-neutral-600">{formatDayEs(today)}</div>
        </div>
      </div>
      <PromotionCard promotion={best} />
    </section>
  );
}

