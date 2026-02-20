"use client";

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/frontend/hooks/useAuth";

const statusFilters = ["All Status", "Pending", "Processing", "Completed", "Failed"] as const;

const statusStyles: Record<string, string> = {
  Pending: "bg-slate-100 text-slate-600",
  Processing: "bg-[#fff6dd] text-[#f59e0b]",
  Completed: "bg-[#ecfdf3] text-[#16a34a]",
  Failed: "bg-[#fee2e2] text-[#ef4444]"
};

const statusMap: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Failed"
};

const dateRanges = ["Last 7 days", "Last 30 days", "This year"];
const PAGE_SIZE = 7;

export default function Page() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("All Status");
  const [networkFilter, setNetworkFilter] = useState("All Networks");
  const [dateRange, setDateRange] = useState(dateRanges[1]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [userOrdersModal, setUserOrdersModal] = useState<{ userId: string; username: string } | null>(null);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [userOrdersLoading, setUserOrdersLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);

  useEffect(() => {
    const loadOrders = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/orders?scope=all&limit=500", {
          headers: { "x-user-id": user.id }
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          setError(data?.error ?? "Unable to load orders.");
          setOrders([]);
          return;
        }
        setOrders(data?.orders ?? []);
      } catch {
        setError("Unable to load orders.");
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [user?.id]);

  const activeOrders = useMemo(
    () => orders.filter((order) => ["PROCESSING", "PENDING"].includes(order.status)).length,
    [orders]
  );

  const networkOptions = useMemo(() => {
    const networks = Array.from(
      new Set(
        orders
          .map((order) => order.network?.displayName ?? order.network?.name)
          .filter(Boolean)
      )
    );
    return ["All Networks", ...networks];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const referenceDate = new Date();
    const withinRange = (dateString: string) => {
      const parsed = new Date(dateString);
      if (Number.isNaN(parsed.getTime())) return true;
      const diffDays = (referenceDate.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24);
      if (dateRange === "Last 7 days") return diffDays <= 7;
      if (dateRange === "Last 30 days") return diffDays <= 30;
      if (dateRange === "This year") return parsed.getFullYear() === referenceDate.getFullYear();
      return true;
    };
      return orders.filter((order) => {
      const statusLabel = statusMap[order.status] ?? order.status;
      const matchesSearch =
        !query ||
        order.orderNumber.toLowerCase().includes(query) ||
        (order.user?.username ?? "").toLowerCase().includes(query) ||
        (order.user?.phoneNumber ?? "").toLowerCase().includes(query) ||
        (order.network?.displayName ?? "").toLowerCase().includes(query) ||
        (order.dataPlan?.name ?? "").toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "All Status" || statusLabel === statusFilter;
      const matchesNetwork =
        networkFilter === "All Networks" ||
        order.network?.displayName === networkFilter ||
        order.network?.name === networkFilter;
      const matchesDate = withinRange(order.createdAt);
      return matchesSearch && matchesStatus && matchesNetwork && matchesDate;
    });
  }, [search, statusFilter, networkFilter, dateRange, orders]);

  const ordersTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE)),
    [filteredOrders.length]
  );
  const visibleOrders = useMemo(() => {
    const start = (ordersPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, ordersPage]);
  useEffect(() => {
    setOrdersPage(1);
  }, [search, statusFilter, networkFilter, dateRange]);

  const handleRefresh = () => {
    if (user?.id) {
      setLoading(true);
      fetch("/api/orders?scope=all", { headers: { "x-user-id": user.id } })
        .then((res) => res.json().catch(() => ({})))
        .then((data) => setOrders(data?.orders ?? []))
        .catch(() => setOrders([]))
        .finally(() => setLoading(false));
    }
  };

  const openUserOrders = async (userId: string, username: string) => {
    setUserOrdersModal({ userId, username });
    setUserOrders([]);
    setUserOrdersLoading(true);
    try {
      const res = await fetch(`/api/orders?userId=${encodeURIComponent(userId)}&limit=200`, {
        headers: { "x-user-id": user!.id }
      });
      const data = await res.json().catch(() => ({}));
      setUserOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch {
      setUserOrders([]);
    } finally {
      setUserOrdersLoading(false);
    }
  };

  const handleOrderAction = async (orderId: string, action: "resend" | "cancel" | "complete" | "cancel_refund" | "deduct_wallet") => {
    if (!user?.id) return;
    setActionLoadingId(orderId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ action })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Action failed.");
        return;
      }
      handleRefresh();
    } catch {
      setError("Unable to process action.");
    } finally {
      setActionLoadingId(null);
      setMenuOpenId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Order Management</p>
          <h1 className="mt-2 text-2xl font-black text-[#0f172a] md:text-3xl">Track and resolve customer orders</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-[#e7efff] px-3 py-1 font-semibold text-[#2563eb]">
              {activeOrders} Active
            </span>
            <span className="rounded-full bg-[#f1f5f9] px-3 py-1 font-semibold text-slate-600">
              {orders.length} Total
            </span>
            {filteredOrders.length > 8 ? (
              <span className="rounded-full bg-[#f8fafc] px-3 py-1 font-semibold text-slate-500">
                Showing 8 of {filteredOrders.length}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
              <path d="M13.7 21a2 2 0 01-3.4 0" />
            </svg>
          </button>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
            System Status
            <span className="flex items-center gap-1 text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Online
            </span>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              className="w-full bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-400"
              placeholder="Search by Order ID, Phone Number or Name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value)}
            >
              {dateRanges.map((range) => (
                <option key={range}>{range}</option>
              ))}
            </select>
            <select
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
              value={networkFilter}
              onChange={(event) => setNetworkFilter(event.target.value)}
            >
              {networkOptions.map((network) => (
                <option key={network}>{network}</option>
              ))}
            </select>
            <button
              className="flex items-center gap-2 rounded-full bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white"
              onClick={handleRefresh}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 11-2.6-6.4" />
                <path d="M21 3v6h-6" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                filter === statusFilter
                  ? "bg-[#0f172a] text-white"
                  : "bg-[#f1f5f9] text-slate-600 hover:bg-[#e2e8f0]"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4 md:hidden">
          {visibleOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              {loading ? "Loading orders..." : "No orders found."}
            </div>
          ) : (
            visibleOrders.map((order) => {
              const statusLabel = statusMap[order.status] ?? order.status;
              const planLabel = order.dataPlan?.dataAmount ?? order.dataPlan?.name ?? "Plan";
              const canRefund = order.paymentStatus === "COMPLETED" && order.paymentStatus !== "REFUNDED";
              const canResend = order.status !== "COMPLETED";
              return (
                <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{order.orderNumber}</p>
                      <p className="text-xs text-slate-500">
                        {order.user ? (
                          <button
                            type="button"
                            onClick={() => openUserOrders(order.user.id, order.user.username ?? "Customer")}
                            className="font-semibold text-[#2563eb] hover:underline"
                          >
                            {order.user.username ?? "Customer"}
                          </button>
                        ) : (
                          "Customer"
                        )}{" "}
                        • {order.user?.phoneNumber ?? "—"}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[statusLabel] ?? "bg-slate-100 text-slate-600"}`}>
                      {statusLabel}
                    </span>
                  </div>
                  {order.status === "FAILED" && order.failedReason ? (
                    <p className="mt-2 text-xs text-rose-600">{order.failedReason}</p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">Recipient&apos;s Number</p>
                      <p className="font-semibold text-slate-700">{order.recipientNumber ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">Network</p>
                      <p className="font-semibold text-slate-700">{order.network?.displayName ?? order.network?.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">Plan</p>
                      <p className="font-semibold text-slate-700">{planLabel}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400">Amount</p>
                      <p className="font-semibold text-slate-900">{order.currency} {order.amount.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center justify-end">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuOpenId(menuOpenId === order.id ? null : order.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
                          aria-label="Order actions"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                            <circle cx="12" cy="5" r="1.6" />
                            <circle cx="12" cy="12" r="1.6" />
                            <circle cx="12" cy="19" r="1.6" />
                          </svg>
                        </button>
                        {menuOpenId === order.id ? (
                          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                            <button
                              type="button"
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              onClick={() => handleOrderAction(order.id, "resend")}
                              disabled={!canResend || actionLoadingId === order.id}
                            >
                              Resend To Provider
                            </button>
                            <button
                              type="button"
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              onClick={() => handleOrderAction(order.id, "complete")}
                              disabled={actionLoadingId === order.id}
                            >
                              Mark Complete
                            </button>
                            <button
                              type="button"
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              onClick={() => handleOrderAction(order.id, "cancel")}
                              disabled={actionLoadingId === order.id}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                              onClick={() => handleOrderAction(order.id, "cancel_refund")}
                              disabled={!canRefund || actionLoadingId === order.id}
                            >
                              Cancel With Refund
                            </button>
                            {order.paymentMethod !== "WALLET" && order.amount > 0 ? (
                              <button
                                type="button"
                                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                                onClick={() => handleOrderAction(order.id, "deduct_wallet")}
                                disabled={actionLoadingId === order.id}
                                title="Deduct order amount from customer wallet (use when order was paid by wallet but not deducted)"
                              >
                                Deduct wallet (fix)
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 hidden overflow-visible rounded-2xl border border-slate-100 md:block">
          <table className="w-full text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-4 text-left">Order ID</th>
                <th className="px-4 py-4 text-left">Customer</th>
                <th className="px-4 py-4 text-left">Recipient</th>
                <th className="px-4 py-4 text-left">Network</th>
                <th className="px-4 py-4 text-left">Plan</th>
                <th className="px-4 py-4 text-left">Amount</th>
                <th className="px-4 py-4 text-left">Status</th>
                <th className="px-4 py-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    {loading ? "Loading orders..." : "No orders found."}
                  </td>
                </tr>
              ) : (
                visibleOrders.map((order) => {
                  const statusLabel = statusMap[order.status] ?? order.status;
                  const planLabel = order.dataPlan?.dataAmount ?? order.dataPlan?.name ?? "Plan";
                  const canRefund = order.paymentStatus === "COMPLETED" && order.paymentStatus !== "REFUNDED";
                  const canResend = order.status !== "COMPLETED";
                  return (
                    <tr key={order.id} className="border-t border-slate-100">
                      <td className="px-4 py-4 font-semibold text-slate-700">{order.orderNumber}</td>
                      <td className="px-4 py-4 text-slate-600">
                        {order.user ? (
                          <button
                            type="button"
                            onClick={() => openUserOrders(order.user.id, order.user.username ?? "Customer")}
                            className="text-left font-semibold text-[#2563eb] hover:underline"
                          >
                            {order.user.username ?? "Customer"}
                          </button>
                        ) : (
                          "Customer"
                        )}
                        <div className="text-xs text-slate-400">{order.user?.phoneNumber}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{order.recipientNumber ?? "—"}</td>
                      <td className="px-4 py-4 text-slate-600">{order.network?.displayName ?? order.network?.name}</td>
                      <td className="px-4 py-4 text-slate-600">{planLabel}</td>
                      <td className="px-4 py-4 text-slate-900 font-semibold">{order.currency} {order.amount.toFixed(2)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[statusLabel] ?? "bg-slate-100 text-slate-600"}`}>
                            {statusLabel}
                          </span>
                          {order.status === "FAILED" && order.failedReason ? (
                            <span className="text-[11px] text-rose-600">
                              {order.failedReason}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="overflow-visible px-4 py-4">
                        <div className="relative inline-flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => setMenuOpenId(menuOpenId === order.id ? null : order.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
                            aria-label="Order actions"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                              <circle cx="12" cy="5" r="1.6" />
                              <circle cx="12" cy="12" r="1.6" />
                              <circle cx="12" cy="19" r="1.6" />
                            </svg>
                          </button>
                          {menuOpenId === order.id ? (
                            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                              <button
                                type="button"
                                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                onClick={() => handleOrderAction(order.id, "resend")}
                                disabled={!canResend || actionLoadingId === order.id}
                              >
                                Resend To Provider
                              </button>
                              <button
                                type="button"
                                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                onClick={() => handleOrderAction(order.id, "complete")}
                                disabled={actionLoadingId === order.id}
                              >
                                Mark Complete
                              </button>
                              <button
                                type="button"
                                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                onClick={() => handleOrderAction(order.id, "cancel")}
                                disabled={actionLoadingId === order.id}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                                onClick={() => handleOrderAction(order.id, "cancel_refund")}
                                disabled={!canRefund || actionLoadingId === order.id}
                              >
                                Cancel With Refund
                              </button>
                              {order.paymentMethod !== "WALLET" && order.amount > 0 ? (
                                <button
                                  type="button"
                                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                                  onClick={() => handleOrderAction(order.id, "deduct_wallet")}
                                  disabled={actionLoadingId === order.id}
                                  title="Deduct order amount from customer wallet (use when order was paid by wallet but not deducted)"
                                >
                                  Deduct wallet (fix)
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredOrders.length > PAGE_SIZE ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-[#f8fafc] px-4 py-3">
            <p className="text-sm text-slate-600">
              Showing {(ordersPage - 1) * PAGE_SIZE + 1}–{Math.min(ordersPage * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                disabled={ordersPage <= 1}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {ordersPage} of {ordersTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages, p + 1))}
                disabled={ordersPage >= ordersTotalPages}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {userOrdersModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setUserOrdersModal(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-lg font-bold text-slate-900">Orders by {userOrdersModal.username}</h2>
              <button type="button" onClick={() => setUserOrdersModal(null)} className="rounded-full p-1 text-slate-500 hover:bg-slate-100">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              {userOrdersLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">Loading orders…</p>
              ) : userOrders.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No orders found.</p>
              ) : (
                <ul className="space-y-3">
                  {userOrders.map((order) => {
                    const statusLabel = statusMap[order.status] ?? order.status;
                    const planLabel = order.dataPlan?.dataAmount ?? order.dataPlan?.name ?? "Plan";
                    return (
                      <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm">
                        <div>
                          <span className="font-semibold text-slate-800">{order.orderNumber}</span>
                          <span className="ml-2 text-slate-500">{order.recipientNumber ?? "—"}</span>
                          <span className="mx-2 text-slate-300">·</span>
                          <span className="text-slate-500">{order.network?.displayName ?? order.network?.name}</span>
                          <span className="mx-2 text-slate-300">·</span>
                          <span className="text-slate-600">{planLabel}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-900">{order.currency} {typeof order.amount === "number" ? order.amount.toFixed(2) : order.amount}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[statusLabel] ?? "bg-slate-100 text-slate-600"}`}>{statusLabel}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
