"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/frontend/components/ui/dialog";
import { Input } from "@/frontend/components/ui/input";
import { Button } from "@/frontend/components/ui/button";
import { useRewards } from "@/frontend/hooks/useRewards";
import { useAuth } from "@/frontend/hooks/useAuth";
import { formatCurrency } from "@/shared/utils/formatters";
import Link from "next/link";
import { downloadCsv } from "@/frontend/lib/exportCsv";

const typeLabels: Record<string, string> = {
  EARNED: "Earned (Cashback)",
  SPENT: "Spent on Bundle",
  WITHDRAWN: "Withdrawn (MoMo)",
  EXPIRED: "Expired Rewards",
  ADJUSTED: "Adjusted"
};

type TransactionTab = "all" | "refer" | "purchases" | "withdrawals";

const statusConfig: Record<
  string,
  { label: string; badge: string }
> = {
  WITHDRAWN: { label: "Processing", badge: "bg-[#fff6dd] text-[#f59e0b]" },
  EXPIRED: { label: "Expired", badge: "bg-[#fee2e2] text-[#ef4444]" }
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const MIN_WITHDRAWAL = 300;
const PAGE_SIZE = 7;

export default function RewardsPage() {
  const { balance, transactions, tier, withdrawFunds } = useRewards();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TransactionTab>("all");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showRefer, setShowRefer] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [referralLink, setReferralLink] = useState("");
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rewardsPage, setRewardsPage] = useState(1);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return transactions;
    return transactions.filter((item) => {
      const label = typeLabels[item.type] ?? item.description;
      return (
        label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        (item.referenceNumber ?? "").toLowerCase().includes(query)
      );
    });
  }, [search, transactions]);

  const monthlyEarned = useMemo(() => {
    const now = new Date();
    return transactions
      .filter((item) => {
        if (item.type !== "EARNED" && item.type !== "ADJUSTED") return false;
        const date = new Date(item.createdAt);
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      })
      .reduce((total, item) => total + item.amount, 0);
  }, [transactions]);

  const loyaltyPoints = useMemo(
    () => Math.max(0, Math.round(balance.totalEarned * 20)),
    [balance.totalEarned]
  );

  const displayedTransactions = useMemo(() => {
    const base = filteredTransactions;
    if (activeTab === "refer") {
      return base.filter(
        (item) =>
          (item.type === "EARNED" && (item.description?.toLowerCase().includes("referral") ?? item.referredUsername != null)) ||
          (item.type === "ADJUSTED" && item.description?.toLowerCase().includes("referral"))
      );
    }
    if (activeTab === "purchases") {
      return base.filter((item) => item.type === "SPENT");
    }
    if (activeTab === "withdrawals") {
      return base.filter((item) => item.type === "WITHDRAWN");
    }
    return base;
  }, [activeTab, filteredTransactions]);

  const rewardsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(displayedTransactions.length / PAGE_SIZE)),
    [displayedTransactions.length]
  );
  const visibleRewardsTransactions = useMemo(() => {
    const start = (rewardsPage - 1) * PAGE_SIZE;
    return displayedTransactions.slice(start, start + PAGE_SIZE);
  }, [displayedTransactions, rewardsPage]);

  useEffect(() => {
    setRewardsPage(1);
  }, [activeTab]);

  const handleWithdraw = async () => {
    setActionError(null);
    setActionNotice(null);
    const amount = Number(withdrawAmount);
    if (Number.isNaN(amount) || amount < MIN_WITHDRAWAL) {
      setActionError(`Minimum withdrawal is GHS ${MIN_WITHDRAWAL.toFixed(2)}.`);
      return;
    }
    const result = await withdrawFunds(amount);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setActionNotice("Withdrawal request created.");
    setWithdrawAmount("");
    setShowWithdraw(false);
  };

  const handleReferOpen = async () => {
    setShowRefer(true);
    setReferralError(null);
    setCopied(false);
    if (!user?.id) {
      setReferralError("Unable to load your referral link.");
      return;
    }
    setReferralLoading(true);
    try {
      const response = await fetch(`/api/referrals/link?userId=${user.id}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setReferralError(data?.error ?? "Unable to load referral link.");
        return;
      }
      setReferralLink(data?.link ?? "");
    } catch {
      setReferralError("Unable to load referral link.");
    } finally {
      setReferralLoading(false);
    }
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (showWithdraw) {
      document.body.classList.add("hide-mobile-nav");
    } else {
      document.body.classList.remove("hide-mobile-nav");
    }
    return () => {
      document.body.classList.remove("hide-mobile-nav");
    };
  }, [showWithdraw]);

  return (
    <div className="flex flex-col gap-6">
      <div className="md:hidden">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="text-base font-semibold text-slate-900">Wallet &amp; Rewards</div>
          <div className="h-10 w-10" aria-hidden="true" />
        </div>

        {actionNotice ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-600">
            {actionNotice}
          </div>
        ) : null}
        {actionError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {actionError}
          </div>
        ) : null}

        <section className="mt-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-[0_18px_32px_rgba(15,23,42,0.25)]">
          <p className="text-xs font-semibold text-white/70">Available Rewards Balance</p>
          <h2 className="mt-2 text-3xl font-black">{formatCurrency(balance.currentBalance, "GHS")}</h2>
          <p className="mt-1 text-xs text-white/70">
            You&apos;ve earned this from referrals and purchases. Keep it up!
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#0f172a]"
              onClick={handleReferOpen}
            >
              Refer a Friend
            </button>
            <button
              type="button"
              className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setShowWithdraw(true)}
            >
              Withdraw
            </button>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">Earned This Month</p>
            <p className="mt-2 text-sm font-semibold text-emerald-600">
              + {formatCurrency(monthlyEarned, "GHS")}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">Loyalty Points</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{loyaltyPoints.toLocaleString()}</p>
          </div>
        </div>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Transaction History</h2>
              <p className="text-xs text-slate-500">Registration referrals, purchase cashback, and withdrawals</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-b border-slate-100 overflow-x-auto pb-px">
            {[
              { key: "all" as const, label: "All" },
              { key: "refer" as const, label: "Refer" },
              { key: "purchases" as const, label: "Purchases" },
              { key: "withdrawals" as const, label: "Withdrawals" }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-3 py-2 text-xs font-semibold ${
                  activeTab === tab.key
                    ? "border-b-2 border-[#2563eb] text-[#2563eb]"
                    : "text-slate-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {displayedTransactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                {activeTab === "withdrawals"
                  ? "No withdrawals yet."
                  : activeTab === "refer"
                  ? "No referral earnings yet."
                  : activeTab === "purchases"
                  ? "No bundle purchases using rewards yet."
                  : "No transactions yet."}
              </div>
            ) : null}
            {visibleRewardsTransactions.map((item) => {
              const isReferTab = activeTab === "refer";
              const username = item.referredUsername ?? (item.description?.match(/referral bonus from (.+)$/i)?.[1] ?? "—");
              const purchaseAmount = item.orderAmount ?? null;
              const status = "Completed";

              if (isReferTab) {
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{username}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(item.createdAt)} • {formatTime(item.createdAt)}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                        {status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="text-slate-500">Amount of Purchase</span>
                      <span className="font-semibold text-slate-900">
                        {purchaseAmount != null ? formatCurrency(purchaseAmount, "GHS") : "—"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Commission</span>
                      <span className="font-semibold text-emerald-600">+{formatCurrency(item.amount, "GHS")}</span>
                    </div>
                  </div>
                );
              }

              const label = typeLabels[item.type] ?? item.description;
              const isCredit = item.type === "EARNED" || item.type === "ADJUSTED";
              const signedAmount = isCredit
                ? `+${item.amount.toFixed(2)}`
                : `-${item.amount.toFixed(2)}`;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isCredit ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
                    }`}
                  >
                    <span className="text-xs font-semibold">
                      {item.type === "SPENT" ? "Buy" : item.type === "WITHDRAWN" ? "W" : "Rw"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{label}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(item.createdAt)} • {formatTime(item.createdAt)}
                    </p>
                  </div>
                  <div className={`text-sm font-semibold ${isCredit ? "text-emerald-600" : "text-rose-500"}`}>
                    {signedAmount}
                  </div>
                </div>
              );
            })}
          </div>
          <button className="mt-4 w-full text-xs font-semibold text-[#2563eb]">
            View All Activity →
          </button>
        </section>
      </div>

      <div className="hidden md:flex md:flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Customer Rewards</h1>
            <p className="text-sm text-slate-500">Track and manage your GhBundle earnings</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 md:flex">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                className="w-48 bg-transparent text-sm text-slate-600 outline-none"
                placeholder="Search rewards..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </header>

        {actionNotice ? (
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-600">
            {actionNotice}
          </div>
        ) : null}
        {actionError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {actionError}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl bg-[var(--accent)] p-8 text-[#0f172a] shadow-[0_18px_40px_rgba(var(--accent-rgb)/0.35)]">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0f172a]/70">
              Available Rewards Balance
            </p>
            <h2 className="mt-2 text-4xl font-black">
              {formatCurrency(balance.currentBalance, "GHS")}
            </h2>
            <p className="mt-3 max-w-md text-sm text-[#0f172a]/80">
              You&apos;ve earned this from referrals and purchases. Keep it up!
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#0f172a] shadow-sm"
                onClick={() => setShowWithdraw(true)}
                type="button"
              >
                Withdraw Funds
              </button>
              <button
                className="rounded-full border border-white/60 px-5 py-2 text-sm font-semibold text-[#0f172a]"
                onClick={handleReferOpen}
                type="button"
              >
                Refer a Friend
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgb(var(--accent-rgb)/0.2)] text-[#0f172a]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l2.1 4.3 4.7.7-3.4 3.3.8 4.7L12 13.8 7.8 15.1l.8-4.7L5.2 7l4.7-.7L12 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">Tier Status</p>
                <p className="text-lg font-bold text-slate-900">{tier.name}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              You&apos;re building momentum with every purchase.
            </p>
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Lifetime Earned</span>
                <span className="text-slate-900">{formatCurrency(tier.lifetimeEarned, "GHS")}</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${tier.progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {formatCurrency(tier.remaining, "GHS")} until {tier.nextTier}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Transaction History</h2>
              <p className="text-sm text-slate-500">
                Registration referrals, purchase cashback, and withdrawals
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50/50 p-1">
                {[
                  { key: "all" as const, label: "All" },
                  { key: "refer" as const, label: "Refer" },
                  { key: "purchases" as const, label: "Purchases" },
                  { key: "withdrawals" as const, label: "Withdrawals" }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                      activeTab === tab.key
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                onClick={() => {
                  const rows = displayedTransactions.map((item) => {
                    if (activeTab === "refer") {
                      const username = item.referredUsername ?? item.description?.match(/referral bonus from (.+)$/i)?.[1] ?? "—";
                      return {
                        Date: `${formatDate(item.createdAt)} ${formatTime(item.createdAt)}`.trim(),
                        Username: username,
                        "Amount of Purchase": item.orderAmount != null ? item.orderAmount.toFixed(2) : "—",
                        Commission: `+${item.amount.toFixed(2)}`,
                        Status: "Completed"
                      };
                    }
                    const status = statusConfig[item.type] ?? { label: "Completed" };
                    const signedAmount =
                      item.type === "EARNED" || item.type === "ADJUSTED"
                        ? `+${item.amount.toFixed(2)}`
                        : `-${item.amount.toFixed(2)}`;
                    return {
                      Date: `${formatDate(item.createdAt)} ${formatTime(item.createdAt)}`.trim(),
                      Type: typeLabels[item.type] ?? item.description,
                      Reference: item.referenceNumber ?? "",
                      Amount: signedAmount,
                      Status: status.label
                    };
                  });
                  const cols = activeTab === "refer"
                    ? ["Date", "Username", "Amount of Purchase", "Commission", "Status"]
                    : ["Date", "Type", "Reference", "Amount", "Status"];
                  downloadCsv(
                    activeTab === "refer" ? "refer-history.csv" : "rewards-transactions.csv",
                    rows,
                    cols
                  );
                }}
              >
                Export
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
                <tr>
                  {activeTab === "refer" ? (
                    <>
                      <th className="px-6 py-3 text-left">Date</th>
                      <th className="px-6 py-3 text-left">Username</th>
                      <th className="px-6 py-3 text-left">Amount of Purchase</th>
                      <th className="px-6 py-3 text-left">Commission</th>
                      <th className="px-6 py-3 text-left">Status</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-3 text-left">Date</th>
                      <th className="px-6 py-3 text-left">Type</th>
                      <th className="px-6 py-3 text-left">Order / Ref</th>
                      <th className="px-6 py-3 text-left">Amount (GHS)</th>
                      <th className="px-6 py-3 text-left">Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                      {activeTab === "withdrawals"
                        ? "No withdrawals yet."
                        : activeTab === "refer"
                        ? "No referral earnings yet."
                        : activeTab === "purchases"
                        ? "No bundle purchases using rewards yet."
                        : "No transactions yet."}
                    </td>
                  </tr>
                ) : null}
                {visibleRewardsTransactions.map((item) => {
                  if (activeTab === "refer") {
                    const username = item.referredUsername ?? item.description?.match(/referral bonus from (.+)$/i)?.[1] ?? "—";
                    const purchaseAmount = item.orderAmount;
                    const status = "Completed";
                    return (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-slate-700">{formatDate(item.createdAt)}</div>
                          <div className="text-xs text-slate-400">{formatTime(item.createdAt)}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">{username}</td>
                        <td className="px-6 py-4 text-slate-700">
                          {purchaseAmount != null ? formatCurrency(purchaseAmount, "GHS") : "—"}
                        </td>
                        <td className="px-6 py-4 font-semibold text-emerald-600">+{formatCurrency(item.amount, "GHS")}</td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-[#ecfdf3] px-3 py-1 text-xs font-semibold text-[#16a34a]">
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                  const label = typeLabels[item.type] ?? item.description;
                  const status = statusConfig[item.type] ?? {
                    label: "Completed",
                    badge: "bg-[#ecfdf3] text-[#16a34a]"
                  };
                  const signedAmount =
                    item.type === "EARNED" || item.type === "ADJUSTED"
                      ? `+${item.amount.toFixed(2)}`
                      : `-${item.amount.toFixed(2)}`;
                  return (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-700">{formatDate(item.createdAt)}</div>
                        <div className="text-xs text-slate-400">{formatTime(item.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{label}</td>
                      <td className="px-6 py-4 text-[var(--accent)]">
                        {item.referenceNumber ?? "—"}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {signedAmount}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.badge}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {displayedTransactions.length > PAGE_SIZE ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
              <p className="text-sm text-slate-600">
                Showing {(rewardsPage - 1) * PAGE_SIZE + 1}–{Math.min(rewardsPage * PAGE_SIZE, displayedTransactions.length)} of {displayedTransactions.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRewardsPage((p) => Math.max(1, p - 1))}
                  disabled={rewardsPage <= 1}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {rewardsPage} of {rewardsTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setRewardsPage((p) => Math.min(rewardsTotalPages, p + 1))}
                  disabled={rewardsPage >= rewardsTotalPages}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
              Showing {displayedTransactions.length} of {transactions.length} transactions
            </div>
          )}
        </section>
      </div>

      <Dialog open={showWithdraw} onClose={() => setShowWithdraw(false)} mobileBottomSheet>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleWithdraw();
          }}
          className="p-6 pb-8"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Withdraw Rewards</h3>
              <p className="mt-1 text-sm text-slate-500">
                Send rewards to your MoMo account.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWithdraw(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Available balance</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(balance.currentBalance, "GHS")}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Minimum withdrawal: GHS {MIN_WITHDRAWAL.toFixed(2)}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Amount (GHS)</label>
              <Input
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                placeholder={`Minimum ${MIN_WITHDRAWAL.toFixed(2)}`}
                className="mt-2 rounded-xl border-slate-200 bg-white text-sm text-slate-700 focus:border-[#0f172a] focus:ring-[#0f172a]/10"
              />
            </div>
          </div>

          {actionError ? (
            <p className="mt-3 text-sm text-red-500">{actionError}</p>
          ) : null}
          {actionNotice ? (
            <p className="mt-3 text-sm text-emerald-600">{actionNotice}</p>
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl"
              onClick={() => setShowWithdraw(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-xl bg-[#0f172a] text-white shadow-sm transition hover:bg-[#0b1223]"
            >
              Withdraw
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={showRefer} onClose={() => setShowRefer(false)} mobileBottomSheet>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Referral Link</h3>
              <p className="mt-1 text-sm text-slate-500">
                Share this link. You&apos;ll earn 0.5% when they make their first purchase.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRefer(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="mt-5">
            {referralError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {referralError}
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={referralLoading ? "Generating link..." : referralLink}
                  readOnly
                />
                <Button
                  type="button"
                  className="sm:w-auto"
                  onClick={async () => {
                    if (!referralLink) return;
                    await navigator.clipboard.writeText(referralLink);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied!" : "Copy Link"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
