import type { Promotion } from "@/lib/schemas/promotion";

export const mockPromotions: Promotion[] = [
  {
    id: "galicia-super-1",
    title: "25% en Supermercados",
    bank: "Galicia",
    category: "Supermarket",
    store: "Coto / Jumbo (seleccionados)",
    cardNetworks: ["Visa", "Mastercard"],
    days: ["wednesday"],
    paymentMethods: ["Physical", "NFC"],
    discountPercent: 25,
    capArs: 12000,
    notes: "Tope por cuenta. Puede requerir inscripción según promo.",
    validFrom: null,
    validTo: null,
    source: { type: "scraper_placeholder", url: null }
  },
  {
    id: "galicia-dining-1",
    title: "20% en Gastronomía",
    bank: "Galicia",
    category: "Dining",
    store: "Restaurantes adheridos",
    cardNetworks: ["Visa", "Mastercard", "Amex"],
    days: ["friday", "saturday"],
    paymentMethods: ["NFC", "Physical"],
    discountPercent: 20,
    capArs: 8000,
    notes: "Válido en locales adheridos.",
    validFrom: null,
    validTo: null,
    source: { type: "scraper_placeholder", url: null }
  },
  {
    id: "santander-fuel-1",
    title: "15% en Combustible",
    bank: "Santander",
    category: "Fuel",
    store: "YPF (estaciones adheridas)",
    cardNetworks: ["Visa", "Mastercard"],
    days: ["monday", "tuesday"],
    paymentMethods: ["QR"],
    discountPercent: 15,
    capArs: 6000,
    notes: "Pago con QR (Modo/Mercado Pago según promo).",
    validFrom: null,
    validTo: null,
    source: { type: "scraper_placeholder", url: null }
  },
  {
    id: "santander-super-1",
    title: "30% en Supermercados",
    bank: "Santander",
    category: "Supermarket",
    store: "Carrefour (seleccionados)",
    cardNetworks: ["Visa", "Mastercard"],
    days: ["thursday"],
    paymentMethods: ["Physical"],
    discountPercent: 30,
    capArs: 15000,
    notes: "Tope semanal. Ver bases y condiciones.",
    validFrom: null,
    validTo: null,
    source: { type: "scraper_placeholder", url: null }
  }
];

