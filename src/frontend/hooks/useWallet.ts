import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/frontend/hooks/useAuth";

interface WalletBalance {
  totalAdded: number;
  totalSpent: number;
  currentBalance: number;
}

export function useWallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<WalletBalance>({
    totalAdded: 0,
    totalSpent: 0,
    currentBalance: 0
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setBalance({ totalAdded: 0, totalSpent: 0, currentBalance: 0 });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/wallet/balance?userId=${user.id}`, {
        cache: "no-store"
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setLoading(false);
        return;
      }
      setBalance({
        totalAdded: data?.totalAdded ?? 0,
        totalSpent: data?.totalSpent ?? 0,
        currentBalance: data?.currentBalance ?? 0
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    const interval = window.setInterval(refreshIfVisible, 30000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [user?.id, refresh]);

  const addFunds = useCallback(
    async (amount: number) => {
      if (!user?.id) {
        return { ok: false, error: "Login required." } as const;
      }
      try {
        const response = await fetch("/api/wallet/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, amount })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          return { ok: false, error: data?.error ?? "Unable to add funds." } as const;
        }
        return { ok: true } as const;
      } catch {
        return { ok: false, error: "Unable to add funds." } as const;
      }
    },
    [user?.id]
  );

  return { balance, loading, refresh, addFunds };
}
