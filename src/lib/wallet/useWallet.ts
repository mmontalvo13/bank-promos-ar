"use client";

import { useEffect, useMemo, useState } from "react";
import { MyWalletSchema, type MyWallet } from "@/lib/schemas/wallet";
import { safeParseJson } from "@/lib/storage";

const STORAGE_KEY = "bank-promos-ar:my-wallet:v2";

function emptyWallet(): MyWallet {
  return MyWalletSchema.parse({});
}

export function useWallet() {
  const [wallet, setWallet] = useState<MyWallet>(() => emptyWallet());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raw = safeParseJson<unknown>(localStorage.getItem(STORAGE_KEY));
    const parsed = raw ? MyWalletSchema.safeParse(raw) : null;
    setWallet(parsed?.success ? parsed.data : emptyWallet());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
  }, [wallet, hydrated]);

  const api = useMemo(() => {
    return {
      wallet,
      hydrated,
      setWallet,
      reset: () => setWallet(emptyWallet())
    };
  }, [wallet, hydrated]);

  return api;
}

