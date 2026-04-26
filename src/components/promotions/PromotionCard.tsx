import type { Promotion } from "@/lib/schemas/promotion";
import { Badge } from "@/components/ui/Badge";
import { CreditCard, ExternalLink, Nfc, QrCode } from "lucide-react";

function dayLabel(d: Promotion["days"][number]) {
  switch (d) {
    case "monday":
      return "Lu";
    case "tuesday":
      return "Ma";
    case "wednesday":
      return "Mi";
    case "thursday":
      return "Ju";
    case "friday":
      return "Vi";
    case "saturday":
      return "Sa";
    case "sunday":
      return "Do";
  }
}

function isEveryDay(days: Promotion["days"]) {
  return days.length === 7;
}

function displayBankOrWallet(p: Promotion) {
  // Requirement: show bank/wallet but NOT "MODO" (MODO is just a channel).
  if (p.bank === "MODO") {
    if (p.issuerBanks?.length) return p.issuerBanks.join(" · ");
    return "Bancos adheridos";
  }
  return p.bank;
}

function paymentLabelForCard(p: Promotion, method: Promotion["paymentMethods"][number]) {
  if (method === "QR" && p.bank === "MODO") return "MODO (QR)";
  return paymentLabel(method);
}

function paymentIcon(method: Promotion["paymentMethods"][number]) {
  switch (method) {
    case "NFC":
      return Nfc;
    case "QR":
      return QrCode;
    case "Physical":
      return CreditCard;
  }
}

function paymentLabel(method: Promotion["paymentMethods"][number]) {
  switch (method) {
    case "NFC":
      return "NFC";
    case "QR":
      return "QR";
    case "Physical":
      return "Tarjeta";
  }
}

export function PromotionCard({ promotion }: { promotion: Promotion }) {
  const promoUrl =
    promotion.source?.url ??
    (promotion.bank === "MODO" ? "https://www.modo.com.ar/promos" : null);

  return (
    <details className="group h-full rounded-3xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md">
      <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-neutral-700">{displayBankOrWallet(promotion)}</div>
            <div className="mt-0.5 line-clamp-1 text-sm font-extrabold text-neutral-950">{promotion.store}</div>
          </div>
          <div className="shrink-0 rounded-2xl bg-neutral-900 px-3 py-2 text-base font-extrabold text-white">
            {promotion.discountPercent}%
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
          {promotion.imageUrl ? (
            <img
              src={promotion.imageUrl}
              alt={promotion.store}
              className="h-36 w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-36 w-full" />
          )}
        </div>

        <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-neutral-950">{promotion.title}</h3>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge className="bg-neutral-50 text-neutral-900">
            {isEveryDay(promotion.days) ? "Todos los días" : promotion.days.map(dayLabel).join(" · ")}
          </Badge>
          {promotion.capArs ? (
            <Badge className="border-neutral-200 bg-neutral-50 text-neutral-800">
              Tope: ${promotion.capArs.toLocaleString("es-AR")}
            </Badge>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {promotion.paymentMethods.map((m) => {
            const Icon = paymentIcon(m);
            return (
              <span
                key={m}
                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs font-semibold text-neutral-900"
                title={paymentLabelForCard(promotion, m)}
              >
                <Icon className="h-3.5 w-3.5" />
                {paymentLabelForCard(promotion, m)}
              </span>
            );
          })}
        </div>
      </summary>

      <div className="border-t border-neutral-200 px-4 pb-4 pt-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge>{promotion.category}</Badge>
          {promotion.cardNetworks.map((n) => (
            <Badge key={n} className="text-neutral-700">
              {n}
            </Badge>
          ))}
        </div>

        {promotion.notes ? (
          <p className="mt-3 text-sm leading-relaxed text-neutral-700">{promotion.notes}</p>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-neutral-600">Más detalles</div>
          {promoUrl ? (
            <a
              href={promoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Ver promo
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </details>
  );
}

