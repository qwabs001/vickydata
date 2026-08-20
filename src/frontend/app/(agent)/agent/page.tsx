"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/frontend/components/ui/dialog";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useOrders } from "@/frontend/hooks/useOrders";
import { useRewards } from "@/frontend/hooks/useRewards";
import { useWallet } from "@/frontend/hooks/useWallet";
import {
  getCanonicalNetworkDisplayName,
  getNetworkInitials,
  getNetworkLogoUrl
} from "@/frontend/lib/networkBranding";
import { formatCurrency } from "@/shared/utils/formatters";

type FeaturedPlan = {
  id: string;
  networkId?: string;
  name?: string;
  dataAmount?: string;
  price: number;
  currency?: string;
  network?: {
    id?: string;
    name?: string;
    displayName?: string;
    logoUrl?: string;
  };
};

const getOrderDisplayStatus = (order: { status: string; failedReason?: string | null }) => {
  if (order.status === "FAILED") return "Pending";
  if (order.status === "COMPLETED") return "Completed";
  if (order.status === "PROCESSING") return "In Progress";
  if (order.status === "PENDING") return "Pending";
  if (order.status === "CANCELLED") return "Cancelled";
  return "Cancelled";
};

export default function AgentDashboardPage() {
  const { user } = useAuth();
  const { orders, loading, error, refresh: refreshOrders } = useOrders();
  const { balance: rewardsBalance } = useRewards();
  const {
    balance: walletBalance,
    loading: walletLoading,
    refresh: refreshWallet
  } = useWallet();

  const [featuredPlans, setFeaturedPlans] = useState<FeaturedPlan[]>([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNotice, setWalletNotice] = useState<string | null>(null);
  const [walletAddSubmitting, setWalletAddSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const reference =
      params.get("ref") ||
      params.get("reference") ||
      params.get("transaction_ref") ||
      params.get("txn_ref") ||
      params.get("trxref");
    if (params.get("payment") === "success" && reference) {
      fetch(
        `/api/payments/verify?ref=${encodeURIComponent(reference)}&userId=${encodeURIComponent(user.id)}`
      )
        .then((res) => res.json().catch(() => null))
        .then(() => {
          refreshOrders();
          refreshWallet();
        })
        .catch(() => {
          refreshOrders();
          refreshWallet();
        });
      return;
    }
    if (params.get("payment") === "success") {
      refreshOrders();
      refreshWallet();
    }
  }, [user?.id, refreshOrders, refreshWallet]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    const loadPlans = async () => {
      try {
        const params = new URLSearchParams({
          scope: "public",
          limit: "12",
          userId: user.id
        });
        const response = await fetch(`/api/data-plans?${params.toString()}`);
        const data = await response.json().catch(() => []);
        if (!active) return;
        if (!response.ok) {
          setFeaturedPlans([]);
          return;
        }
        const plans = Array.isArray(data) ? data : [];
        const featured = plans.filter((plan) => Boolean(plan.isFeatured)).slice(0, 4);
        const fallback = featured.length > 0 ? featured : plans.slice(0, 4);
        setFeaturedPlans(fallback as FeaturedPlan[]);
      } catch {
        if (!active) return;
        setFeaturedPlans([]);
      }
    };

    loadPlans();
    return () => {
      active = false;
    };
  }, [user?.id]);

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

  const metrics = useMemo(() => {
    const completed = orders.filter((order) => order.status === "COMPLETED");
    const inProgress = orders.filter(
      (order) => order.status === "PROCESSING" || order.status === "PENDING"
    );
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.amount ?? 0), 0);
    const totalSales = completed.reduce((sum, order) => sum + Number(order.amount ?? 0), 0);

    return {
      totalOrders: orders.length,
      inProgressOrders: inProgress.length,
      totalSpent,
      totalSales
    };
  }, [orders]);

  const trend = useMemo(() => {
    const points: Array<{ day: string; value: number; height: number }> = [];
    const today = new Date();
    for (let idx = 6; idx >= 0; idx -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - idx);
      const key = day.toISOString().slice(0, 10);
      const amount = orders
        .filter((order) => order.createdAt.slice(0, 10) === key && order.status === "COMPLETED")
        .reduce((sum, order) => sum + Number(order.amount ?? 0), 0);
      points.push({
        day: day.toLocaleDateString("en-US", { weekday: "short" }),
        value: amount,
        height: 0
      });
    }
    const max = Math.max(1, ...points.map((point) => point.value));
    return points.map((point) => ({
      ...point,
      height: Math.max(6, (point.value / max) * 100)
    }));
  }, [orders]);

  const recentOrders = useMemo(() => orders.slice(0, 6), [orders]);

  const mobileOrders = useMemo(() => {
    const badgeForStatus = (status: string) => {
      if (status === "Completed") return "text-[#16a34a]";
      if (status === "In Progress") return "text-[#f59e0b]";
      if (status === "Pending") return "text-slate-500";
      return "text-[#ef4444]";
    };

    return orders.slice(0, 3).map((order) => {
      const displayStatus = getOrderDisplayStatus(order);
      const networkNameRaw = order.network?.displayName ?? order.network?.name ?? "Network";
      const networkName = getCanonicalNetworkDisplayName(networkNameRaw) || networkNameRaw;
      const networkLogo = getNetworkLogoUrl(networkNameRaw, order.network?.logoUrl);
      return {
        id: order.id,
        network: networkName,
        networkInitials: getNetworkInitials(networkNameRaw),
        networkLogo,
        plan: order.dataPlan?.dataAmount ?? order.dataPlan?.name ?? "Data Plan",
        price: formatCurrency(order.amount, order.currency),
        status: displayStatus,
        badge: badgeForStatus(displayStatus)
      };
    });
  }, [orders]);

  const handleWalletAddFunds = async () => {
    const amount = Number(walletAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !user?.id) {
      setWalletNotice("Enter a valid amount.");
      return;
    }

    setWalletAddSubmitting(true);
    setWalletNotice(null);
    try {
      const ref = `WALLET-${user.id}-${Date.now()}`;
      const response = await fetch("/api/payments/initialize", {
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
      const data = await response.json().catch(() => null);
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
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden pb-24 sm:gap-6 md:pb-0">
      <section className="min-w-0 md:hidden">
        <div>
          <p className="text-sm text-slate-500">Welcome back,</p>
          <h1 className="text-2xl font-black text-slate-900">{user?.username ?? "Agent"}</h1>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Link
            href="/agent/buy-data"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#0f172a] px-6 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.2)]"
          >
            Buy Data
          </Link>
          <Link
            href="/agent/api"
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700"
          >
            API
          </Link>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Wallet</p>
            <p className="mt-2 text-lg font-black text-slate-900">
              {walletLoading ? "..." : formatCurrency(walletBalance.currentBalance, "GHS")}
            </p>
            <p className="mt-1 text-xs text-slate-500">Use wallet funds for bundle purchases.</p>
          </div>
          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-[#0f172a] px-4 py-3 text-sm font-semibold text-white"
            onClick={() => setShowWalletModal(true)}
          >
            Add Funds
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-slate-900 p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-white/70">Cashback Rewards</p>
              <h2 className="mt-2 text-2xl font-black">
                {formatCurrency(rewardsBalance.currentBalance, "GHS")}
              </h2>
              <p className="mt-1 text-xs text-white/70">Available Balance</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />
                <path d="M2 7h20v5H2z" />
                <path d="M12 22V7" />
                <path d="M12 7a2.5 2.5 0 1 0-5 0" />
                <path d="M12 7a2.5 2.5 0 1 1 5 0" />
              </svg>
            </div>
          </div>
          <button className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[#0f172a]">
            Redeem Now
          </button>
        </div>
      </section>

      <section className="hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:block">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-[#0f172a]">Agent Dashboard</h1>
            <p className="text-sm text-slate-500">Customer-style experience with agent analytics and API access.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/agent/buy-data" className="rounded-full bg-[#0f172a] px-5 py-2 text-sm font-semibold text-white">
              Buy Data
            </Link>
            <Link href="/agent/api" className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700">
              API
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="hidden md:flex md:items-center md:justify-between md:rounded-2xl md:border md:border-slate-200 md:bg-white md:px-5 md:py-4 md:shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f172a] text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 7h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
              <path d="M16 7V5a2 2 0 0 0-2-2H5" />
              <path d="M16 12h4" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-500">Wallet Balance</p>
            <p className="text-2xl font-black text-slate-900">
              {walletLoading ? "..." : formatCurrency(walletBalance.currentBalance, "GHS")}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="rounded-full bg-[#0f172a] px-5 py-2 text-sm font-semibold text-white"
          onClick={() => setShowWalletModal(true)}
        >
          Add Funds
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Orders" value={metrics.totalOrders.toLocaleString()} tone="blue" />
        <MetricCard label="In Progress" value={metrics.inProgressOrders.toLocaleString()} tone="amber" />
        <MetricCard label="Total Sales" value={formatCurrency(metrics.totalSales, "GHS")} tone="green" />
        <MetricCard label="Amount Spent" value={formatCurrency(metrics.totalSpent, "GHS")} tone="slate" />
        <MetricCard label="Cashback Rewards" value={formatCurrency(rewardsBalance.currentBalance, "GHS")} tone="purple" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Sales Trends</h2>
              <p className="text-sm text-slate-500">Completed order value in the last 7 days</p>
            </div>
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">7 days</span>
          </div>
          <div className="mt-5 flex h-52 items-end gap-2 rounded-2xl bg-[#f8fafc] p-4">
            {trend.map((point) => (
              <div key={point.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-500">
                  {point.value > 0 ? formatCurrency(point.value, "GHS") : "-"}
                </span>
                <div className="w-full rounded-t-lg bg-[#2563eb]" style={{ height: `${point.height}%` }} />
                <span className="text-[11px] text-slate-600">{point.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Balances</h2>
          <p className="text-sm text-slate-500">Current available balances</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">Wallet</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(walletBalance.currentBalance, "GHS")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">Rewards</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(rewardsBalance.currentBalance, "GHS")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowWalletModal(true)}
                className="inline-flex rounded-full bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white"
              >
                Add Funds
              </button>
              <Link href="/agent/wallet" className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">
                Open Wallet
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Quick Buy</h2>
          <Link href="/agent/buy-data" className="text-xs font-semibold text-[#2563eb]">
            View all plans
          </Link>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {featuredPlans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 sm:col-span-2">
              No featured plans yet.
            </div>
          ) : (
            featuredPlans.map((plan) => {
              const networkNameRaw = plan.network?.displayName ?? plan.network?.name ?? "Network";
              const networkName = getCanonicalNetworkDisplayName(networkNameRaw) || networkNameRaw;
              const networkLogo = getNetworkLogoUrl(networkNameRaw, plan.network?.logoUrl);
              const networkId = plan.networkId ?? plan.network?.id ?? "";
              const buyHref = `/agent/buy-data?planId=${plan.id}${networkId ? `&networkId=${networkId}` : ""}`;

              return (
                <div key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                        {networkLogo ? (
                          <Image src={networkLogo} alt={networkName} width={28} height={28} className="h-7 w-7 object-contain" />
                        ) : (
                          <span className="text-[10px] font-bold text-slate-700">{getNetworkInitials(networkNameRaw)}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{plan.dataAmount ?? plan.name}</p>
                        <p className="text-xs text-slate-500">{networkName}</p>
                      </div>
                    </div>
                    <Link
                      href={buyHref}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] text-white"
                      aria-label={`Buy ${plan.dataAmount ?? plan.name}`}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="9" cy="20" r="1" />
                        <circle cx="18" cy="20" r="1" />
                        <path d="M2 3h3l2.4 11.3a2 2 0 0 0 2 1.7h7.9a2 2 0 0 0 2-1.6L21 7H6" />
                      </svg>
                    </Link>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-lg font-black text-slate-900">{formatCurrency(plan.price, plan.currency ?? "GHS")}</p>
                    <p className="text-xs font-semibold text-emerald-600">No Expiry</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Recent Orders</h2>
          <Link href="/agent/orders" className="text-xs font-semibold text-[#2563eb]">View All</Link>
        </div>
        <div className="mt-3 grid gap-3">
          {mobileOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              {loading ? "Loading orders..." : "No orders yet."}
            </div>
          ) : (
            mobileOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[#0f172a] text-[11px] font-bold text-white">
                      {order.networkLogo ? (
                        <Image src={order.networkLogo} alt={order.network} width={30} height={30} className="h-7 w-7 object-contain" />
                      ) : (
                        order.networkInitials
                      )}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-900">{order.plan}</p>
                      <p className="text-sm text-slate-500">{order.price}</p>
                    </div>
                  </div>
                  <Link href="/agent/buy-data" className="rounded-full bg-[#e7efff] px-4 py-1 text-sm font-semibold text-[#2563eb]">
                    Buy Again
                  </Link>
                </div>
                <p className={`mt-3 text-sm font-bold ${order.badge}`}>{order.status}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hidden md:block">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent Orders</h2>
            <p className="text-sm text-slate-500">Latest purchase activity</p>
          </div>
          <Link href="/agent/orders" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
            View All
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Network</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading orders...</td>
                </tr>
              ) : recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No orders yet.</td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-800">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{order.network?.displayName ?? order.network?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{order.dataPlan?.dataAmount ?? order.dataPlan?.name ?? "-"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(order.amount, order.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={showWalletModal} onClose={() => setShowWalletModal(false)} mobileBottomSheet>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900">Add Wallet Funds</h3>
          <p className="mt-1 text-sm text-slate-500">You will be redirected to Moolre to complete payment.</p>
          {walletNotice ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{walletNotice}</p>
          ) : null}
          <div className="mt-4 space-y-2">
            <label className="text-sm font-semibold text-slate-700">Amount (GHS)</label>
            <input
              value={walletAmount}
              onChange={(event) => setWalletAmount(event.target.value)}
              placeholder="50"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
            />
          </div>
          <button
            type="button"
            onClick={handleWalletAddFunds}
            disabled={walletAddSubmitting}
            className="mt-5 w-full rounded-xl bg-[#0f172a] px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
          >
            {walletAddSubmitting ? "Please wait..." : "Proceed to Payment"}
          </button>
          <button
            type="button"
            onClick={async () => {
              await refreshWallet();
              setShowWalletModal(false);
            }}
            className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
          >
            Refresh Wallet
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function statusLabel(status: string): string {
  if (status === "PROCESSING") return "In Progress";
  if (status === "COMPLETED") return "Completed";
  if (status === "PENDING") return "Pending";
  if (status === "FAILED") return "Pending";
  if (status === "CANCELLED") return "Cancelled";
  return "Cancelled";
}

function statusBadge(status: string): string {
  if (status === "COMPLETED") return "bg-[#ecfdf3] text-[#16a34a]";
  if (status === "PROCESSING") return "bg-[#fff6dd] text-[#f59e0b]";
  if (status === "PENDING") return "bg-slate-100 text-slate-600";
  if (status === "FAILED") return "bg-slate-100 text-slate-600";
  if (status === "CANCELLED") return "bg-[#fee2e2] text-[#ef4444]";
  return "bg-[#fee2e2] text-[#ef4444]";
}

function MetricCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "blue" | "amber" | "green" | "slate" | "purple";
}) {
  const toneClass: Record<typeof tone, string> = {
    blue: "bg-[#e7efff] text-[#2563eb]",
    amber: "bg-[#fff6dd] text-[#f59e0b]",
    green: "bg-[#ecfdf3] text-[#16a34a]",
    slate: "bg-slate-100 text-slate-700",
    purple: "bg-[#ede9fe] text-[#7c3aed]"
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
      <span className={`mt-3 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${toneClass[tone]}`}>
        Agent
      </span>
    </div>
  );
}
