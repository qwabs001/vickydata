"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/shared/utils/formatters";
import { useAuth } from "@/frontend/hooks/useAuth";
import { downloadCsv } from "@/frontend/lib/exportCsv";

const statusFilters = ["All", "Completed", "Processing"] as const;

export default function Page() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("All");
  const [transactions, setTransactions] = useState<
    { id: string; date: string; type: string; user: string; amount: number; status: string }[]
  >([]);
  const [summary, setSummary] = useState({
    availableBalance: 0,
    totalEarned: 0,
    totalSpent: 0,
    totalWithdrawn: 0,
    monthlyEarned: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRewards = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const [summaryResponse, transactionsResponse] = await Promise.all([
          fetch("/api/admin/rewards/summary", {
            headers: { "x-user-id": user.id }
          }),
          fetch("/api/admin/rewards/transactions", {
            headers: { "x-user-id": user.id }
          })
        ]);
        const summaryData = await summaryResponse.json().catch(() => null);
        const transactionsData = await transactionsResponse.json().catch(() => null);
        if (!summaryResponse.ok) {
          setError(summaryData?.error ?? "Unable to load rewards summary.");
        }
        if (!transactionsResponse.ok) {
          setError(transactionsData?.error ?? "Unable to load rewards transactions.");
        }
        if (summaryResponse.ok) {
          setSummary(summaryData ?? summary);
        }
        if (transactionsResponse.ok) {
          setTransactions(transactionsData?.transactions ?? []);
        }
      } catch {
        setError("Unable to load rewards data.");
      } finally {
        setLoading(false);
      }
    };

    loadRewards();
  }, [user?.id]);

  const availableBalance = useMemo(() => summary.availableBalance ?? 0, [summary.availableBalance]);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((txn) => {
      const matchesSearch =
        !query ||
        txn.user.toLowerCase().includes(query) ||
        txn.type.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "All" || txn.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, transactions]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-[#0f172a] sm:text-2xl">Transactions</h1>
          <p className="text-sm text-slate-500">Track rewards payouts and balances.</p>
        </div>
        <Link href="/admin/rewards/config" className="w-full rounded-full bg-[#2563eb] px-4 py-2 text-center text-xs font-semibold text-white sm:w-auto">
          Rewards Config
        </Link>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-[#0b0f1a] p-4 text-white shadow-[0_18px_40px_rgba(15,23,42,0.4)] sm:p-6 lg:col-span-2">
          <div className="pointer-events-none absolute -right-10 top-8 h-32 w-32 rounded-full bg-[#f6c500]/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-16 bottom-[-30px] h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
              Available Rewards Balance
            </p>
            <div className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-widest text-white/60">
              Rewards Card
            </div>
          </div>
          <p className="mt-4 text-2xl font-black sm:text-3xl">{formatCurrency(availableBalance, "GHS")}</p>
          <p className="mt-2 text-sm text-white/70">
            Total rewards earned this month: {formatCurrency(summary.monthlyEarned ?? 0, "GHS")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
            <Link href="/admin/withdrawals" className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#0b0f1a]">
              Process Withdrawals
            </Link>
            <button
              className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold text-white"
              onClick={() => {
                const rows = [
                  {
                    AvailableBalance: summary.availableBalance ?? 0,
                    TotalEarned: summary.totalEarned ?? 0,
                    TotalSpent: summary.totalSpent ?? 0,
                    TotalWithdrawn: summary.totalWithdrawn ?? 0,
                    MonthlyEarned: summary.monthlyEarned ?? 0
                  }
                ];
                downloadCsv("rewards-summary.csv", rows, [
                  "AvailableBalance",
                  "TotalEarned",
                  "TotalSpent",
                  "TotalWithdrawn",
                  "MonthlyEarned"
                ]);
              }}
            >
              Export Report
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:p-6">
          <p className="text-sm font-semibold text-slate-600">Tier Status</p>
          <h3 className="mt-3 text-lg font-bold text-[#0f172a]">Gold Rewards Member</h3>
          <p className="mt-1 text-xs text-slate-500">Top 5% of users this month</p>
          <div className="mt-6 rounded-xl bg-[#f8fafc] p-4">
            <p className="text-xs text-slate-500">Lifetime Earned</p>
            <p className="mt-2 text-lg font-bold text-[#0f172a]">
              {formatCurrency(summary.totalEarned ?? 0, "GHS")}
            </p>
            <div className="mt-3 h-2 rounded-full bg-slate-200">
              <div className="h-2 w-2/3 rounded-full bg-[#f6c500]" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-[#0f172a]">Transaction History</h2>
          <div className="flex items-center gap-3">
            <button
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              onClick={() => {
                const rows = filteredTransactions.map((row) => ({
                  Date: new Date(row.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  }),
                  Type: row.type,
                  User: row.user,
                  Amount: row.amount,
                  Status: row.status
                }));
                downloadCsv("rewards-transactions.csv", rows, [
                  "Date",
                  "Type",
                  "User",
                  "Amount",
                  "Status"
                ]);
              }}
            >
              Export
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-[#f8fafc] px-4 py-2 text-sm text-slate-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              className="w-full bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-400"
              placeholder="Search by user or transaction type..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                filter === statusFilter
                  ? "bg-[#2563eb] text-white"
                  : "bg-[#f1f5f9] text-slate-600"
              }`}
            >
              {filter}
            </button>
          ))}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Amount (GHS)</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={5}>
                    {loading ? "Loading transactions..." : "No transactions match your filters."}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((row) => (
                  <tr key={row.date + row.user} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-600">{new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.type === "EARNED"
                        ? "Earned (Cashback)"
                        : row.type === "SPENT"
                        ? "Spent on Bundle"
                        : row.type === "WITHDRAWN"
                        ? "Withdraw (MoMo)"
                        : row.type === "EXPIRED"
                        ? "Expired Rewards"
                        : row.type === "ADJUSTED"
                        ? "Adjusted"
                        : row.type}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.user}</td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        row.type === "WITHDRAWN" || row.type === "SPENT" || row.type === "EXPIRED"
                          ? "text-rose-500"
                          : "text-emerald-600"
                      }`}
                    >
                      {row.type === "WITHDRAWN" || row.type === "SPENT" || row.type === "EXPIRED"
                        ? "-"
                        : "+"}
                      {formatCurrency(Math.abs(row.amount), "GHS")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status === "Completed" ? "bg-[#ecfdf3] text-[#16a34a]" : "bg-[#fff6dd] text-[#f59e0b]"}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
