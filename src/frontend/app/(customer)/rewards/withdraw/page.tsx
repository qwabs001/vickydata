"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Dialog } from "@/frontend/components/ui/dialog";
import { useWallet } from "@/frontend/hooks/useWallet";
import { useAuth } from "@/frontend/hooks/useAuth";
import { formatCurrency } from "@/shared/utils/formatters";

type WalletTransaction = {
  id: string;
  type: "ADDED" | "SPENT";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
};

export default function WalletPage() {
  const { user } = useAuth();
  const { balance, loading, addFunds, refresh } = useWallet();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNotice, setWalletNotice] = useState<string | null>(null);
  const [walletAddSubmitting, setWalletAddSubmitting] = useState(false);

  const loadTransactions = useCallback(async () => {
    if (!user?.id) {
      setTransactions([]);
      return;
    }
    setTransactionsLoading(true);
    try {
      const response = await fetch(`/api/wallet/transactions?userId=${user.id}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setTransactions([]);
        return;
      }
      setTransactions(data?.transactions ?? []);
    } catch {
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Note: Paystack webhook handles payment verification automatically
  // Removed Moolre reconcile - we're using Paystack now

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (showWalletModal) {
      document.body.classList.add("hide-mobile-nav");
    } else {
      document.body.classList.remove("hide-mobile-nav");
    }
    return () => {
      document.body.classList.remove("hide-mobile-nav");
    };
  }, [showWalletModal]);

  const summary = useMemo(() => {
    const totalAdded = transactions
      .filter((item) => item.type === "ADDED")
      .reduce((sum, item) => sum + item.amount, 0);
    const totalSpent = transactions
      .filter((item) => item.type === "SPENT")
      .reduce((sum, item) => sum + item.amount, 0);
    return { totalAdded, totalSpent };
  }, [transactions]);

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
          <div className="text-base font-semibold text-slate-900">Wallet</div>
          <div className="h-10 w-10" aria-hidden="true" />
        </div>

        <section className="mt-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-[0_18px_32px_rgba(15,23,42,0.25)]">
          <p className="text-xs font-semibold text-white/70">Wallet Balance</p>
          <h2 className="mt-2 text-3xl font-black">
            {loading ? "..." : formatCurrency(balance.currentBalance, "GHS")}
          </h2>
          <p className="mt-1 text-xs text-white/70">
            Use wallet funds to pay for bundle purchases.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 px-3 py-3 text-xs">
              <p className="text-white/70">Total Added</p>
              <p className="mt-2 text-sm font-semibold">
                {formatCurrency(summary.totalAdded, "GHS")}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-3 text-xs">
              <p className="text-white/70">Total Spent</p>
              <p className="mt-2 text-sm font-semibold">
                {formatCurrency(summary.totalSpent, "GHS")}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="mt-5 w-full rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#0f172a]"
            onClick={() => setShowWalletModal(true)}
          >
            Add Funds
          </button>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Wallet Transactions</h2>
              <p className="text-xs text-slate-500">Deposits and bundle deductions.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {transactionsLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                Loading transactions...
              </div>
            ) : null}
            {!transactionsLoading && transactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No wallet transactions yet.
              </div>
            ) : null}
            {transactions.map((item) => {
              const isCredit = item.type === "ADDED";
              const isAdmin = item.description?.startsWith("Admin ");
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.type === "ADDED" ? "Wallet Top Up" : isAdmin ? "Admin Adjustment" : "Bundle Purchase"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(item.createdAt)} • {formatTime(item.createdAt)}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${isCredit ? "text-emerald-600" : "text-rose-500"}`}>
                      {isCredit ? "+" : "-"}
                      {item.amount.toFixed(2)} GHS
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="hidden md:flex md:flex-col md:gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Wallet</h1>
            <p className="text-sm text-slate-500">
              Track deposits and wallet payments for bundle purchases.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full bg-[#0f172a] px-5 py-2 text-sm font-semibold text-white"
            onClick={() => setShowWalletModal(true)}
          >
            Add Funds
          </button>
        </header>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl bg-[var(--accent)] p-8 text-[#0f172a] shadow-[0_18px_40px_rgba(var(--accent-rgb)/0.35)]">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0f172a]/70">
              Wallet Balance
            </p>
            <h2 className="mt-2 text-4xl font-black">
              {loading ? "..." : formatCurrency(balance.currentBalance, "GHS")}
            </h2>
            <p className="mt-3 max-w-md text-sm text-[#0f172a]/80">
              Use wallet funds to pay for data bundle purchases instantly.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/60 px-4 py-4 text-sm">
                <p className="text-xs font-semibold text-[#0f172a]/60">Total Added</p>
                <p className="mt-2 text-lg font-bold">{formatCurrency(summary.totalAdded, "GHS")}</p>
              </div>
              <div className="rounded-2xl bg-white/60 px-4 py-4 text-sm">
                <p className="text-xs font-semibold text-[#0f172a]/60">Total Spent</p>
                <p className="mt-2 text-lg font-bold">{formatCurrency(summary.totalSpent, "GHS")}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <p className="text-sm font-semibold text-slate-600">Wallet Summary</p>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Total Added</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(summary.totalAdded, "GHS")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Spent</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(summary.totalSpent, "GHS")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Current Balance</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(balance.currentBalance, "GHS")}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Wallet Transactions</h2>
              <p className="text-sm text-slate-500">
                Only deposits and bundle deductions.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">Description</th>
                  <th className="px-6 py-3 text-left">Amount (GHS)</th>
                  <th className="px-6 py-3 text-left">Balance After</th>
                </tr>
              </thead>
              <tbody>
                {transactionsLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                      Loading transactions...
                    </td>
                  </tr>
                ) : null}
                {!transactionsLoading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                      No wallet transactions yet.
                    </td>
                  </tr>
                ) : null}
                {transactions.map((item) => {
                  const isCredit = item.type === "ADDED";
                  const isAdmin = item.description?.startsWith("Admin ");
                  const label = item.type === "ADDED"
                    ? "Deposited"
                    : isAdmin
                      ? "Admin Adjustment"
                      : "Bundle Purchase";
                  return (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-700">{formatDate(item.createdAt)}</div>
                        <div className="text-xs text-slate-400">{formatTime(item.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{label}</td>
                      <td className="px-6 py-4 text-slate-500">{item.description}</td>
                      <td className={`px-6 py-4 font-semibold ${isCredit ? "text-emerald-600" : "text-rose-500"}`}>
                        {isCredit ? "+" : "-"}
                        {item.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {formatCurrency(item.balanceAfter, "GHS")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={showWalletModal} onClose={() => setShowWalletModal(false)} mobileBottomSheet>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Add Wallet Funds</h3>
              <p className="mt-1 text-sm text-slate-500">
                Add funds and use them for bundle purchases.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWalletModal(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {walletNotice ? (
            <p className={`mt-3 rounded-xl px-4 py-3 text-sm ${
              walletNotice.startsWith("Enter") || walletNotice.startsWith("Unable")
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}>
              {walletNotice}
            </p>
          ) : null}
          <div className="mt-5 space-y-3">
            <label className="text-sm font-semibold text-slate-700">Amount to add (GHS)</label>
            <input
              value={walletAmount}
              onChange={(event) => setWalletAmount(event.target.value)}
              placeholder="50"
              disabled={walletAddSubmitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            You will be redirected to Paystack to complete the payment.
          </p>
          <button
            type="button"
            className="mt-6 w-full rounded-xl bg-[#0f172a] px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
            onClick={async () => {
              const amount = Number(walletAmount);
              if (!Number.isFinite(amount) || amount <= 0 || !user?.id) {
                setWalletNotice("Enter a valid amount.");
                return;
              }
              setWalletNotice(null);
              setWalletAddSubmitting(true);
              try {
                const ref = `WALLET-${user.id}-${Date.now()}`;
                const res = await fetch("/api/payments/paystack/initialize", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: user.id,
                    amount,
                    currency: "GHS",
                    ref,
                    type: "wallet"
                  })
                });
                const data = await res.json().catch(() => null);
                if (data?.error) {
                  setWalletNotice(typeof data.error === "string" ? data.error : "Unable to open payment gateway.");
                  setWalletAddSubmitting(false);
                  return;
                }
                if (data?.paymentUrl) {
                  window.location.href = data.paymentUrl;
                  return;
                }
                setWalletNotice("Unable to open payment page. Please try again.");
                setWalletAddSubmitting(false);
              } catch {
                setWalletNotice("Unable to open payment gateway.");
                setWalletAddSubmitting(false);
              }
            }}
            disabled={walletAddSubmitting}
          >
            {walletAddSubmitting ? "Opening Paystack..." : "Add Funds"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
