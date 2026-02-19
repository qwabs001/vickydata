"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useOrders } from "@/frontend/hooks/useOrders";
import {
  getCanonicalNetworkDisplayName,
  getNetworkInitials,
  getNetworkLogoUrl
} from "@/frontend/lib/networkBranding";
import { formatCurrency } from "@/shared/utils/formatters";
import type { OrderSummary } from "@/shared/types";

const statusOptions = ["All Status", "Completed", "In Progress", "Pending", "Failed"] as const;

const statusBadgeStyles: Record<string, string> = {
  Completed: "bg-[#ecfdf3] text-[#16a34a]",
  "In Progress": "bg-[#fff6dd] text-[#f59e0b]",
  Pending: "bg-slate-100 text-slate-600",
  Failed: "bg-[#fee2e2] text-[#ef4444]"
};

const statusMap: Record<string, string> = {
  COMPLETED: "Completed",
  PROCESSING: "In Progress",
  PENDING: "Pending",
  FAILED: "Failed",
  CANCELLED: "Failed"
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

const getStatusLabel = (status: string) => statusMap[status] ?? status;
const isProviderBalanceFailure = (reason?: string | null) =>
  Boolean(reason && reason.toLowerCase().includes("insufficient balance"));
const getDisplayStatus = (order: OrderSummary) => {
  if (order.status === "FAILED" && isProviderBalanceFailure(order.failedReason)) {
    return "In Progress";
  }
  return getStatusLabel(order.status);
};
const getStatusBadge = (label: string) =>
  statusBadgeStyles[label] ?? "bg-slate-100 text-slate-500";

export default function CustomerOrdersPage() {
  const { orders, loading, error, hasMore, loadingMore, loadMore } = useOrders({
    paginated: true,
    pageSize: 20
  });
  const [search, setSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState("All Networks");
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>("All Status");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const total = orders.length;
    const success = orders.filter((order) => getDisplayStatus(order) === "Completed").length;
    const inProgress = orders.filter((order) => getDisplayStatus(order) === "In Progress").length;
    return { total, success, inProgress };
  }, [orders]);

  const networkOptions = useMemo(() => {
    const networks = Array.from(
      new Set(
        orders
          .map((order) => order.network?.displayName || order.network?.name)
          .filter(Boolean)
      )
    );
    return ["All Networks", ...networks];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const statusLabel = getDisplayStatus(order);
      const planLabel = order.dataPlan?.dataAmount ?? order.dataPlan?.name ?? "";
      const networkLabel = order.network?.displayName ?? order.network?.name ?? "";
      const matchesSearch =
        !query ||
        order.orderNumber.toLowerCase().includes(query) ||
        order.recipientNumber.toLowerCase().includes(query) ||
        planLabel.toLowerCase().includes(query);
      const matchesNetwork =
        networkFilter === "All Networks" || networkLabel === networkFilter;
      const matchesStatus =
        statusFilter === "All Status" || statusLabel === statusFilter;
      return matchesSearch && matchesNetwork && matchesStatus;
    });
  }, [search, networkFilter, statusFilter, orders]);

  const handleDownload = async (order: OrderSummary) => {
    setDownloadError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}/invoice`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setDownloadError(data?.error ?? "Unable to download invoice.");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `keldatagh-${order.orderNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Unable to download invoice.");
    }
  };

  const renderNetworkBadge = (order: OrderSummary) => {
    const rawName = order.network?.displayName ?? order.network?.name ?? "Unknown";
    const name = getCanonicalNetworkDisplayName(rawName) || rawName;
    const logo = getNetworkLogoUrl(rawName, order.network?.logoUrl);
    return (
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        {logo ? (
          <Image
            src={logo}
            alt={name}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full border border-slate-200 bg-white object-contain p-1"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-xs font-bold text-[#2563eb]">
            {getNetworkInitials(name)}
          </span>
        )}
        {name}
      </div>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <header className="hidden flex-wrap items-center justify-between gap-4 md:flex">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Purchase History</h1>
          <p className="text-sm text-slate-500">Track all your bundle transactions.</p>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      {downloadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {downloadError}
        </div>
      ) : null}

      <section className="hidden gap-4 md:grid md:grid-cols-3">
        {[
          {
            label: "Total Orders",
            value: summary.total.toLocaleString(),
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
              </svg>
            ),
            color: "bg-[#eef2ff] text-[#2563eb]"
          },
          {
            label: "Successful",
            value: summary.success.toLocaleString(),
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ),
            color: "bg-[#ecfdf3] text-[#16a34a]"
          },
          {
            label: "In Progress",
            value: summary.inProgress.toLocaleString(),
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12h.01" />
                <path d="M12 12h.01" />
                <path d="M16 12h.01" />
              </svg>
            ),
            color: "bg-[#fff6dd] text-[#f59e0b]"
          }
        ].map((card) => (
          <div key={card.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.color}`}>
              {card.icon}
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-500">{card.label}</p>
              <p className="text-xl font-bold text-slate-900">{card.value}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="hidden flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-5 md:flex">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-[#f8fafc] px-4 py-2 text-sm text-slate-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              className="w-full bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-400"
              placeholder="Search phone number or Order ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
            value={networkFilter}
            onChange={(event) => setNetworkFilter(event.target.value)}
          >
            {networkOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <select
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as (typeof statusOptions)[number])}
          >
            {statusOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <button className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M7 12h10" />
              <path d="M10 18h4" />
            </svg>
            More Filters
          </button>
        </div>

        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-4 text-left">Order ID</th>
                  <th className="px-6 py-4 text-left">Date &amp; Time</th>
                  <th className="px-6 py-4 text-left">Network</th>
                  <th className="px-6 py-4 text-left">Data Plan</th>
                  <th className="px-6 py-4 text-left">Recipient</th>
                  <th className="px-6 py-4 text-left">Amount</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-500">
                      {loading ? "Loading orders..." : "No orders found."}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
      const statusLabel = getDisplayStatus(order);
                    const badgeClass = getStatusBadge(statusLabel);
                    const planLabel = order.dataPlan?.dataAmount ?? order.dataPlan?.name ?? "—";
                    return (
                      <tr key={order.id} className="border-t border-slate-100">
                        <td className="px-6 py-4 font-semibold text-slate-700">
                          <div className="flex items-center gap-2">
                            {order.orderNumber}
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(order.orderNumber)}
                              className="text-slate-300 hover:text-slate-500"
                              aria-label="Copy order number"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {formatDate(order.createdAt)} · {formatTime(order.createdAt)}
                        </td>
                        <td className="px-6 py-4">{renderNetworkBadge(order)}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {planLabel}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700">
                          {order.recipientNumber}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {formatCurrency(order.amount, order.currency)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => handleDownload(order)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                            aria-label="Download receipt"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <path d="M7 10l5 5 5-5" />
                              <path d="M12 15V3" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
            <span>
              Showing {filteredOrders.length === 0 ? 0 : 1}-{filteredOrders.length} of {orders.length} orders
            </span>
            {hasMore ? (
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 px-4 pb-6 pt-4 sm:px-5 sm:pt-5 md:hidden">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <Link
              href="/dashboard"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <h2 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-slate-900">Order History</h2>
            <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white" aria-label="More options">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 9h.01" />
                <path d="M15 9h.01" />
                <path d="M9 15h6" />
              </svg>
            </button>
          </div>

          {downloadError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {downloadError}
            </div>
          ) : null}

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              className="w-full bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-400"
              placeholder="Search orders..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="flex min-w-0 flex-wrap gap-2 text-xs font-semibold text-slate-500">
            {statusOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`shrink-0 rounded-full px-3 py-2 transition sm:px-4 ${
                  statusFilter === option
                    ? "bg-[#2563eb] text-white"
                    : "border border-slate-200 bg-white text-slate-500"
                }`}
                onClick={() => setStatusFilter(option)}
              >
                {option === "All Status" ? "All" : option}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              {loading ? "Loading orders..." : "No orders found."}
            </div>
          ) : (
            filteredOrders.map((order) => {
              const statusLabel = getDisplayStatus(order);
              const badgeClass = getStatusBadge(statusLabel);
              const planLabel = order.dataPlan?.dataAmount ?? order.dataPlan?.name ?? "Data";
              const rawNetworkName = order.network?.displayName ?? order.network?.name;
              const logo = getNetworkLogoUrl(rawNetworkName, order.network?.logoUrl);
              const initials = getNetworkInitials(rawNetworkName);
              return (
                <div key={order.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 sm:h-11 sm:w-11">
                        {logo ? (
                          <Image src={logo} alt={order.network?.displayName ?? "Network"} width={28} height={28} className="h-6 w-6 object-contain sm:h-7 sm:w-7" />
                        ) : (
                          <span className="text-xs font-semibold text-slate-600">{initials}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{planLabel} Data Bundle</p>
                        <p className="text-xs text-slate-400">
                          {formatDate(order.createdAt)} • {formatTime(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-slate-900">
                      {formatCurrency(order.amount, order.currency)}
                    </div>
                  </div>
                  <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
                    <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold ${badgeClass}`}>
                      {statusLabel.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownload(order)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500"
                      aria-label="Download invoice"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <path d="M7 10l5 5 5-5" />
                        <path d="M12 15V3" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
          {hasMore ? (
            <button
              type="button"
              className="mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load More Orders"}
            </button>
          ) : null}
        </div>
      </section>

      <section className="hidden rounded-3xl border border-slate-200 bg-[#eef4ff] p-6 shadow-sm md:block">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#2563eb]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h8" />
                <path d="M16 3a5 5 0 0 1 5 5v4" />
                <path d="M8 10h5" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Need help with an order?</h3>
              <p className="text-sm text-slate-500">
                Our customer support is available 24/7 to assist you with any transaction issues.
              </p>
            </div>
          </div>
          <button className="rounded-2xl bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white">
            Contact Support
          </button>
        </div>
      </section>

      <div className="md:hidden">
        <div className="h-20" />
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white px-6 py-3 shadow-[0_-12px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
            {[
              { label: "Home", href: "/dashboard", icon: "home" },
              { label: "Buy", href: "/dashboard/buy-data", icon: "bag" },
              { label: "History", href: "/orders", icon: "clock" },
              { label: "Wallet", href: "/rewards/withdraw", icon: "wallet" },
              { label: "Profile", href: "/profile", icon: "user" }
            ].map((item) => {
              const isActive = item.href === "/orders";
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 ${isActive ? "text-[#2563eb]" : ""}`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                      isActive ? "bg-[#2563eb] text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {item.icon === "home" ? (
                        <>
                          <path d="M3 9l9-7 9 7" />
                          <path d="M9 22V12h6v10" />
                        </>
                      ) : null}
                      {item.icon === "bag" ? (
                        <>
                          <path d="M6 7h12l-1 12H7L6 7z" />
                          <path d="M9 7V5a3 3 0 0 1 6 0v2" />
                        </>
                      ) : null}
                      {item.icon === "clock" ? (
                        <>
                          <circle cx="12" cy="12" r="8" />
                          <path d="M12 8v5l3 2" />
                        </>
                      ) : null}
                      {item.icon === "wallet" ? (
                        <>
                          <path d="M3 7h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                          <path d="M16 7V5a2 2 0 0 0-2-2H5" />
                          <path d="M16 12h4" />
                        </>
                      ) : null}
                      {item.icon === "user" ? (
                        <>
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 20c1.8-3.5 6-5 8-5s6.2 1.5 8 5" />
                        </>
                      ) : null}
                    </svg>
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
