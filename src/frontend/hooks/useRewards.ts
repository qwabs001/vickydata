import { useCallback, useEffect, useMemo, useState } from "react";
import type { RewardsBalance, RewardsTransaction, RewardsTransactionType } from "@/shared/types";
import { useAuth } from "@/frontend/hooks/useAuth";

const tierLevels = [
  { name: "Bronze Rewards Member", min: 0, max: 500 },
  { name: "Silver Rewards Member", min: 500, max: 1500 },
  { name: "Gold Rewards Member", min: 1500, max: 3000 },
  { name: "Platinum Rewards Member", min: 3000, max: Number.POSITIVE_INFINITY }
];

const getSignedAmount = (transaction: RewardsTransaction) => {
  if (transaction.type === "EARNED" || transaction.type === "ADJUSTED") return transaction.amount;
  return -transaction.amount;
};

const sumByType = (transactions: RewardsTransaction[], type: RewardsTransactionType) =>
  transactions
    .filter((item) => item.type === type)
    .reduce((total, item) => total + item.amount, 0);

export function useRewards() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<RewardsTransaction[]>([]);
  const [balance, setBalance] = useState<RewardsBalance>({
    totalEarned: 0,
    totalSpent: 0,
    totalWithdrawn: 0,
    currentBalance: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setTransactions([]);
      setBalance({
        totalEarned: 0,
        totalSpent: 0,
        totalWithdrawn: 0,
        currentBalance: 0
      });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [balanceResponse, transactionsResponse] = await Promise.all([
        fetch(`/api/rewards/balance?userId=${user.id}`),
        fetch(`/api/rewards/transactions?userId=${user.id}`)
      ]);
      const balanceData = await balanceResponse.json().catch(() => null);
      const transactionsData = await transactionsResponse.json().catch(() => null);
      if (!balanceResponse.ok) {
        setError(balanceData?.error ?? "Unable to load rewards balance.");
        return;
      }
      if (!transactionsResponse.ok) {
        setError(transactionsData?.error ?? "Unable to load rewards activity.");
        return;
      }
      setBalance(balanceData);
      setTransactions(transactionsData?.transactions ?? []);
    } catch {
      setError("Unable to load rewards data.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const computedBalance = useMemo<RewardsBalance>(() => {
    if (balance.currentBalance > 0 || transactions.length === 0) {
      return balance;
    }
    const totalEarned = sumByType(transactions, "EARNED") + sumByType(transactions, "ADJUSTED");
    const totalSpent = sumByType(transactions, "SPENT") + sumByType(transactions, "EXPIRED");
    const totalWithdrawn = sumByType(transactions, "WITHDRAWN");
    const currentBalance =
      transactions.reduce((total, item) => total + getSignedAmount(item), 0);

    return {
      totalEarned: Math.max(0, totalEarned),
      totalSpent: Math.max(0, totalSpent),
      totalWithdrawn: Math.max(0, totalWithdrawn),
      currentBalance: Math.max(0, Math.round(currentBalance * 100) / 100)
    };
  }, [balance, transactions]);

  const tier = useMemo(() => {
    const lifetimeEarned = balance.totalEarned;
    const currentTier =
      tierLevels.find((level) => lifetimeEarned >= level.min && lifetimeEarned < level.max) ??
      tierLevels[0];
    const nextTier = tierLevels.find((level) => level.min > currentTier.min);
    const nextTarget = nextTier?.min ?? currentTier.max;
    const progressBase = currentTier.max === Infinity ? currentTier.min + 1 : currentTier.max;
    const progress =
      progressBase === currentTier.min
        ? 100
        : Math.min(100, ((lifetimeEarned - currentTier.min) / (progressBase - currentTier.min)) * 100);
    const remaining = Math.max(0, (nextTarget ?? currentTier.max) - lifetimeEarned);

    return {
      name: currentTier.name,
      lifetimeEarned,
      progress,
      remaining,
      nextTier: nextTier?.name ?? "Top Tier"
    };
  }, [computedBalance.totalEarned]);

  const withdrawFunds = async (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "Enter a valid amount." } as const;
    }
    if (!user?.id) {
      return { ok: false, error: "Please login to continue." } as const;
    }
    try {
      const response = await fetch("/api/rewards/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, amount })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return { ok: false, error: data?.error ?? "Unable to withdraw funds." } as const;
      }
      await refresh();
    } catch {
      return { ok: false, error: "Unable to withdraw funds." } as const;
    }
    return { ok: true } as const;
  };

  const topUpRewards = async (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "Enter a valid amount." } as const;
    }
    if (!user?.id) {
      return { ok: false, error: "Please login to continue." } as const;
    }
    try {
      const response = await fetch("/api/rewards/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount,
          type: "ADJUSTED",
          description: "Wallet Top Up"
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return { ok: false, error: data?.error ?? "Unable to top up." } as const;
      }
      await refresh();
    } catch {
      return { ok: false, error: "Unable to top up." } as const;
    }
    return { ok: true } as const;
  };

  const referFriend = async (name?: string) => {
    if (!user?.id) {
      return { ok: false, error: "Please login to continue." } as const;
    }
    try {
      const response = await fetch("/api/rewards/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount: 15,
          type: "EARNED",
          description: name ? `Referral Bonus (${name})` : "Referral Bonus"
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return { ok: false, error: data?.error ?? "Unable to add referral reward." } as const;
      }
      await refresh();
      return { ok: true } as const;
    } catch {
      return { ok: false, error: "Unable to add referral reward." } as const;
    }
  };

  return {
    balance: computedBalance,
    transactions,
    tier,
    withdrawFunds,
    topUpRewards,
    referFriend,
    refresh,
    loading,
    error
  };
}
