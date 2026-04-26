import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bank Promos AR",
  description: "Find the best bank discounts by day, store, and payment method."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}

