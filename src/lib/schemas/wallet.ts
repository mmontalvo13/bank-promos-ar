import { z } from "zod";
import { BankSchema, PaymentMethodSchema } from "@/lib/schemas/promotion";

export const DigitalWalletSchema = z.enum(["Modo", "MercadoPago"]);
export type DigitalWallet = z.infer<typeof DigitalWalletSchema>;

export const BankCardSchema = z.enum(["Visa", "Mastercard", "Amex"]);
export type BankCard = z.infer<typeof BankCardSchema>;

export const MyWalletSchema = z.object({
  banks: z.array(BankSchema).default([]),
  digitalWallets: z.array(DigitalWalletSchema).default([]),
  bankCards: z
    .record(BankSchema, z.array(BankCardSchema))
    .default({ Galicia: [], Santander: [], BBVA: [], MODO: [] }),
  paymentMethods: z.array(PaymentMethodSchema).default([])
});

export type MyWallet = z.infer<typeof MyWalletSchema>;

