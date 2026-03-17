"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [networks, setNetworks] = useState<{ id: string; name: string; displayName: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      setError(null);
      setLoading(true);
      try {
        const [ordersResponse, usersResponse, networksResponse] = await Promise.all([
          fetch("/api/orders?scope=all&limit=300", { headers: { "x-user-id": user.id } }),
          fetch("/api/users?includeAgents=true&limit=300", { headers: { "x-user-id": user.id } }),
          fetch("/api/networks?scope=all", { headers: { "x-user-id": user.id } })
        ]);
        const ordersData = await ordersResponse.json().catch(() => null);
        const usersData = await usersResponse.json().catch(() => null);
        const networksData = await networksResponse.json().catch(() => null);
        if (!ordersResponse.ok) setError(ordersData?.error ?? "Unable to load orders.");
        else setOrders(Array.isArray(ordersData?.orders) ? ordersData.orders : ordersData ?? []);
        if (!usersResponse.ok) setError(usersData?.error ?? "Unable to load users.");
        else setUsers(Array.isArray(usersData?.users) ? usersData.users : usersData ?? []);
        if (networksResponse.ok && Array.isArray(networksData)) {
          setNetworks(networksData.map((n: { id: string; name: string; displayName: string }) => ({ id: n.id, name: n.name, displayName: n.displayName ?? n.name })));
        }
      } catch {
        setError("Unable to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  const metrics = useMemo(() => {
    const revenueOrders = orders.filter((o) => isRevenueOrder(o));
    const totalRevenue = revenueOrders.reduce((sum, o) => sum + Number(o.amount ?? 0), 0);
    const activeOrders = orders.filter((o) => o.status === "PROCESSING" || o.status === "PENDING").length;
    const uniqueCustomers = users.length;
    const rewardsLiability = totalRevenue * 0.01;
    const today = new Date().toDateString();
    const ordersToday = orders.filter((o) => new Date(o.createdAt).toDateString() === today).length;

    return [
      {
        label: "Total Revenue",
        value: formatCurrency(totalRevenue, "GHS"),
        trend: revenueOrders.length > 0 ? `${revenueOrders.length} paid` : "—",
        accent: "bg-[#e7efff] text-[#2563eb]"
      },
      {
        label: "Active Orders",
        value: String(activeOrders),
        trend: ordersToday > 0 ? `+${ordersToday} today` : "—",
        accent: "bg-[#fff6dd] text-[#f59e0b]"
      },
      {
        label: "Active Users",
        value: uniqueCustomers.toLocaleString("en-US"),
        trend: uniqueCustomers > 0 ? `${uniqueCustomers} customers` : "—",
        accent: "bg-[#ecfdf3] text-[#16a34a]"
      },
      {
        label: "Rewards Liability",
        value: formatCurrency(rewardsLiability, "GHS"),
        trend: "~1% of revenue",
        accent: "bg-[#f1f5f9] text-[#0f172a]"
      }
    ];
  }, [orders, users]);

  const topNetworks = useMemo(() => {
    const totals: Record<string, number> = {};
    orders.filter((o) => isRevenueOrder(o)).forEach((order) => {
      const label = order.network?.displayName ?? order.network?.name ?? "Unknown";
      totals[label] = (totals[label] ?? 0) + Number(order.amount ?? 0);
    });
    const totalAmount = Object.values(totals).reduce((sum, v) => sum + v, 0) || 1;
    const fromOrders = Object.entries(totals)
      .map(([label, amount]) => ({
        label,
        share: `${Math.round((amount / totalAmount) * 100)}%`,
        amount: formatCurrency(amount, "GHS")
      }))
      .sort((a, b) => Number(b.share.replace("%", "")) - Number(a.share.replace("%", "")));
    if (fromOrders.length > 0) return fromOrders;
    return networks.map((n) => ({
      label: n.displayName ?? n.name,
      share: "0%",
      amount: formatCurrency(0, "GHS")
    }));
  }, [orders, networks]);

  const revenueChartData = useMemo(() => {
    const days: { label: string; value: number; date: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("en-GB", { weekday: "short" });
      const dayRevenue = orders
        .filter((o) => isRevenueOrder(o) && o.createdAt?.slice(0, 10) === dateStr)
        .reduce((sum, o) => sum + Number(o.amount ?? 0), 0);
      days.push({ label: dayLabel, value: dayRevenue, date: dateStr });
    }
    const maxVal = Math.max(...days.map((d) => d.value), 1);
    return days.map((d) => ({ ...d, heightPct: (d.value / maxVal) * 100 }));
  }, [orders]);

  const recentOrders = useMemo(() => orders.slice(0, 4), [orders]);

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
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Online
            </span>
          </div>
          <button
            className="rounded-full bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white"
            onClick={() => {
              const rows = orders.map((order) => ({
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
            }}
          >
            Export
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
