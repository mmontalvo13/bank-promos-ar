"use client";

import Link from "next/link";
import { ArrowLeft, Wallet as WalletIcon, RotateCcw } from "lucide-react";
import { useWallet } from "@/lib/wallet/useWallet";
import { BankSchema, PaymentMethodSchema } from "@/lib/schemas/promotion";
import { BankCardSchema, DigitalWalletSchema } from "@/lib/schemas/wallet";
import { ToggleGrid } from "@/components/wallet/ToggleGrid";

const banks = BankSchema.options;
const bankCards = BankCardSchema.options;
const paymentMethods = PaymentMethodSchema.options;
const digitalWallets = DigitalWalletSchema.options;

function paymentLabel(m: (typeof paymentMethods)[number]) {
  switch (m) {
    case "Physical":
      return "Tarjeta física";
    case "NFC":
      return "NFC (contactless)";
    case "QR":
      return "QR (Modo/MP)";
  }
}

export default function WalletPage() {
  const { wallet, hydrated, setWallet, reset } = useWallet();

  const toggle = <T extends string>(key: "banks" | "paymentMethods" | "digitalWallets", item: T) => {
    setWallet((w) => {
      const current = w[key] as unknown as T[];
      const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
      return { ...w, [key]: next } as typeof w;
    });
  };

  const toggleBankCard = (bank: (typeof banks)[number], card: (typeof bankCards)[number]) => {
    setWallet((w) => {
      const current = w.bankCards[bank] ?? [];
      const next = current.includes(card) ? current.filter((x) => x !== card) : [...current, card];
      return { ...w, bankCards: { ...w.bankCards, [bank]: next } };
    });
  };

  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="text-sm font-extrabold tracking-tight text-neutral-950">Mi billetera</div>
              <div className="text-xs font-medium text-neutral-600">Marcá lo que tenés para ver sugerencias mejores</div>
            </div>
          </div>

          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900"
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-neutral-900 text-white">
              <WalletIcon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-neutral-950">Resumen</div>
              <div className="text-xs font-semibold text-neutral-600">
                {hydrated
                  ? `${wallet.banks.length} bancos · ${wallet.digitalWallets.length} wallets · ${wallet.paymentMethods.length} métodos`
                  : "Cargando…"}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-extrabold text-neutral-950">Bancos</div>
          <div className="mt-3">
            <ToggleGrid
              items={banks}
              selected={wallet.banks}
              onToggle={(b) => toggle("banks", b)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-extrabold text-neutral-950">Tarjetas por banco</div>
          <div className="mt-1 text-xs font-semibold text-neutral-600">
            Elegí qué redes tenés en cada banco (ej: BBVA Visa, Galicia Mastercard).
          </div>

          <div className="mt-3 space-y-3">
            {banks.map((b) => (
              <div key={b} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-sm font-extrabold text-neutral-900">{b}</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {bankCards.map((c) => {
                    const selected = (wallet.bankCards[b] ?? []).includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleBankCard(b, c)}
                        className={[
                          "rounded-2xl border px-3 py-3 text-left text-sm font-extrabold transition",
                          selected
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300"
                        ].join(" ")}
                      >
                        <div className="truncate">{c}</div>
                        <div className={selected ? "mt-1 text-xs font-semibold text-white/80" : "mt-1 text-xs font-semibold text-neutral-600"}>
                          {selected ? "La tengo" : "No"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-extrabold text-neutral-950">Wallets digitales</div>
          <div className="mt-3">
            <ToggleGrid
              items={digitalWallets}
              selected={wallet.digitalWallets}
              onToggle={(w) => toggle("digitalWallets", w)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-extrabold text-neutral-950">Métodos de pago</div>
          <div className="mt-3">
            <ToggleGrid
              items={paymentMethods}
              selected={wallet.paymentMethods}
              onToggle={(m) => toggle("paymentMethods", m)}
              getLabel={paymentLabel}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

