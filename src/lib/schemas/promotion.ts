import { z } from "zod";

export const DayOfWeekSchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
]);
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;

export const CategorySchema = z.enum([
  "Supermarket",
  "Fuel",
  "Dining",
  "Pharmacy",
  "Electronics",
  "Fashion",
  "Travel",
  "Other"
]);
export type Category = z.infer<typeof CategorySchema>;

export const BankSchema = z.enum(["Galicia", "Santander", "BBVA", "MODO"]);
export type Bank = z.infer<typeof BankSchema>;

export const CardNetworkSchema = z.enum(["Visa", "Mastercard", "Amex", "Cabal", "Maestro", "Other"]);
export type CardNetwork = z.infer<typeof CardNetworkSchema>;

export const PaymentMethodSchema = z.enum(["NFC", "QR", "Physical"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PromotionEligibilitySchema = z
  .object({
    segment: z.string().min(1).nullable().default(null), // e.g. "Eminent", "Masivo"
    eminent: z.boolean().nullable().default(null),
    haberes: z.boolean().nullable().default(null)
  })
  .nullable()
  .default(null);
export type PromotionEligibility = z.infer<typeof PromotionEligibilitySchema>;

export const PromotionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  bank: BankSchema,
  // For aggregators/wallets like MODO: issuing bank(s) behind the benefit.
  // Kept as free text because MODO includes many Argentine banks beyond our BankSchema.
  issuerBanks: z.array(z.string().min(1)).nullable().default(null),
  imageUrl: z.string().url().nullable().default(null),
  category: CategorySchema,
  store: z.string().min(1),
  cardNetworks: z.array(CardNetworkSchema).min(1),
  days: z.array(DayOfWeekSchema).min(1),
  paymentMethods: z.array(PaymentMethodSchema).min(1),
  discountPercent: z.number().int().min(1).max(100),
  capArs: z.number().int().positive().nullable().default(null),
  eligibility: PromotionEligibilitySchema,
  notes: z.string().nullable().default(null),
  validFrom: z.string().datetime().nullable().default(null),
  validTo: z.string().datetime().nullable().default(null),
  source: z
    .object({
      type: z.enum(["manual", "scraper_placeholder"]),
      url: z.string().url().nullable().default(null)
    })
    .default({ type: "manual", url: null })
});

export type Promotion = z.infer<typeof PromotionSchema>;

