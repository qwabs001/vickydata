"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/shared/utils/formatters";
import { useAuth } from "@/frontend/hooks/useAuth";
import { downloadCsv } from "@/frontend/lib/exportCsv";

const statusMap: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Failed"
};

const statusStyles: Record<string, string> = {
  Pending: "bg-slate-100 text-slate-600",
  Processing: "bg-[#fff6dd] text-[#f59e0b]",
  Completed: "bg-[#ecfdf3] text-[#16a34a]",
  Failed: "bg-[#fee2e2] text-[#ef4444]"
};

function shortOrderId(orderNumber: string) {
  const cleaned = (orderNumber ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned.slice(-5) || "-----";
}

function getOrderCustomerName(order: { user?: { fullName?: string | null; username?: string | null; phoneNumber?: string | null } }) {
  const fullName = order.user?.fullName?.trim();
  if (fullName) return fullName;
  const username = order.user?.username?.trim();
  if (username) return username;
  const phoneNumber = order.user?.phoneNumber?.trim();
  return phoneNumber || "Customer";
}

function isRevenueOrder(order: { status?: string; paymentStatus?: string }) {
  return (
    order.paymentStatus === "COMPLETED" &&
    order.status !== "FAILED" &&
    order.status !== "CANCELLED"
  );
}

export default function Page() {
  const { user } = useAuth();
  const refreshInFlightRef = useRef(false);
  const [dashboard, setDashboard] = useState<{
    summary: {
      totalRevenue: number;
      paidOrdersCount: number;
      activeOrdersCount: number;
      totalCustomersCount: number;
      activeCustomersCount: number;
      rewardsLiability: number;
      ordersToday: number;
    };
    topNetworks: Array<{ id: string; label: string; amount: number }>;
    revenueChartData: Array<{ label: string; value: number; date: string }>;
    recentOrders: any[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!user?.id || refreshInFlightRef.current) return;

    const silent = options?.silent ?? false;
    refreshInFlightRef.current = true;
    setError(null);
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/admin/dashboard", {
        headers: { "x-user-id": user.id },
        cache: "no-store"
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to load dashboard data.");
        if (!silent) {
          setDashboard(null);
        }
        return;
      }
      setDashboard(data);
      setLastUpdatedAt(new Date().toISOString());
    } catch {
      setError("Unable to load dashboard data.");
      if (!silent) {
        setDashboard(null);
      }
    } finally {
      refreshInFlightRef.current = false;
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    void loadData();

    const intervalId = window.setInterval(() => {
      void loadData({ silent: true });
    }, 5000);

    const handleFocus = () => {
      void loadData({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadData({ silent: true });
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadData, user?.id]);

  const metrics = useMemo(() => {
    const summary = dashboard?.summary;
    if (!summary) return [];

    return [
      {
        label: "Total Revenue",
        value: formatCurrency(summary.totalRevenue, "GHS"),
        trend: summary.paidOrdersCount > 0 ? `${summary.paidOrdersCount} paid` : "—",
        accent: "bg-[#e7efff] text-[#2563eb]"
      },
      {
        label: "Active Orders",
        value: String(summary.activeOrdersCount),
        trend: summary.ordersToday > 0 ? `+${summary.ordersToday} today` : "—",
        accent: "bg-[#fff6dd] text-[#f59e0b]"
      },
      {
        label: "Customers",
        value: summary.totalCustomersCount.toLocaleString("en-US"),
        trend: summary.activeCustomersCount > 0 ? `${summary.activeCustomersCount} active` : "—",
        accent: "bg-[#ecfdf3] text-[#16a34a]"
      },
      {
        label: "Rewards Liability",
        value: formatCurrency(summary.rewardsLiability, "GHS"),
        trend: "~1% of revenue",
        accent: "bg-[#f1f5f9] text-[#0f172a]"
      }
    ];
  }, [dashboard]);

  const topNetworks = useMemo(() => {
    const items = dashboard?.topNetworks ?? [];
    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0) || 1;
    return items.map((item) => ({
      label: item.label,
      share: `${Math.round((Number(item.amount ?? 0) / totalAmount) * 100)}%`,
      amount: formatCurrency(item.amount, "GHS")
    }));
  }, [dashboard]);

  const revenueChartData = useMemo(() => {
    const days = dashboard?.revenueChartData ?? [];
    const maxVal = Math.max(...days.map((d) => d.value), 1);
    return days.map((d) => ({ ...d, heightPct: (d.value / maxVal) * 100 }));
  }, [dashboard]);

  const recentOrders = useMemo(() => dashboard?.recentOrders ?? [], [dashboard]);
  const syncLabel = useMemo(() => {
    if (loading && !dashboard) return "Loading";
    if (refreshing) return "Syncing";
    if (!lastUpdatedAt) return "Live";
    const date = new Date(lastUpdatedAt);
    if (Number.isNaN(date.getTime())) return "Live";
    return `Updated ${date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })}`;
  }, [dashboard, lastUpdatedAt, loading, refreshing]);

  const handleExport = async () => {
    if (!user?.id || exporting) return;
    setExporting(true);
    try {
      const response = await fetch("/api/orders?scope=all&limit=500", {
        headers: { "x-user-id": user.id },
        cache: "no-store"
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to export orders.");
        setExporting(false);
        return;
      }
      const orders = Array.isArray(data?.orders) ? data.orders : [];
      const rows = orders.map((order: any) => ({
        OrderNumber: order.orderNumber,
        Customer: getOrderCustomerName(order),
        Phone: order.user?.phoneNumber ?? "",
        Network: order.network?.displayName ?? order.network?.name ?? "",
        Plan: order.dataPlan?.dataAmount ?? order.dataPlan?.name ?? "",
        Amount: order.amount,
        Currency: order.currency,
        Status: order.status,
        CreatedAt: order.createdAt
      }));
      downloadCsv("orders.csv", rows, [
        "OrderNumber",
        "Customer",
        "Phone",
        "Network",
        "Plan",
        "Amount",
        "Currency",
        "Status",
        "CreatedAt"
      ]);
    } catch {
      setError("Unable to export orders.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-[#0f172a] sm:text-2xl">Admin Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of today&apos;s performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500" aria-label="Notifications">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
              <path d="M13.7 21a2 2 0 01-3.4 0" />
            </svg>
          </button>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 sm:px-4">
            <span className="hidden sm:inline">System Status</span>
            <span className="flex items-center gap-1 text-emerald-600">
              <span className={`h-2 w-2 rounded-full ${refreshing ? "bg-amber-500" : "bg-emerald-500"}`} />
              {syncLabel}
            </span>
          </div>
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
            onClick={() => void loadData({ silent: true })}
            type="button"
          >
            Refresh
          </button>
          <button
            className="rounded-full bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white"
            onClick={handleExport}
          >
            {exporting ? "Exporting..." : "Export"}
          </button>
          <Link href="/admin/agents" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
            Agents
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <p className="text-xs text-slate-500 sm:text-sm">{metric.label}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:px-3 sm:py-1 sm:text-xs ${metric.accent}`}>{metric.trend}</span>
            </div>
            <p className="mt-2 text-lg font-black text-[#0f172a] sm:mt-3 sm:text-2xl">{metric.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0f172a]">Revenue Trends</h2>
              <p className="text-sm text-slate-500">Weekly performance snapshot</p>
            </div>
            <span className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">Last 7 days</span>
          </div>
          <div className="mt-4 flex h-44 items-end justify-between gap-1 rounded-2xl bg-gradient-to-br from-[#e7efff]/30 via-[#f8fafc] to-[#fff7dd]/30 px-3 py-3 sm:mt-6 sm:h-56 sm:gap-2 sm:px-4 sm:py-4">
            {revenueChartData.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[9px] font-semibold text-slate-500 sm:text-[10px]">
                  {day.value > 0 ? formatCurrency(day.value, "GHS") : "—"}
                </span>
                <div
                  className="w-full min-h-[4px] rounded-t-lg bg-[#2563eb] transition-all duration-500"
                  style={{ height: `${Math.max(day.heightPct, 4)}%` }}
                  title={`${day.label}: ${formatCurrency(day.value, "GHS")}`}
                />
                <span className="text-[10px] font-medium text-slate-600 sm:text-xs">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0f172a]">Top Networks</h2>
              <p className="text-sm text-slate-500">By revenue share</p>
            </div>
            <Link href="/admin/services" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
              Manage
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {topNetworks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                No network data yet.
              </div>
            ) : (
              topNetworks.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-[#f8fafc] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0f172a]">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.share} of sales</p>
                  </div>
                  <p className="text-sm font-semibold text-[#0f172a]">{item.amount}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">Recent Orders</h2>
            <p className="text-sm text-slate-500">Latest customer activity</p>
          </div>
          <Link href="/admin/orders" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
            View All
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100 sm:mt-5">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Order ID</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Network</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    No recent orders.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order: any) => {
                  const statusLabel = statusMap[order.status] ?? order.status;
                  return (
                    <tr key={order.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-700" title={order.orderNumber}>
                        #{shortOrderId(order.orderNumber)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {getOrderCustomerName(order)}
                        <div className="text-xs text-slate-400">{order.user?.phoneNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{order.network?.displayName ?? order.network?.name}</td>
                      <td className="px-4 py-3 text-slate-900 font-semibold">{formatCurrency(order.amount, order.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[statusLabel] ?? "bg-slate-100 text-slate-600"}`}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
