"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Dialog } from "@/frontend/components/ui/dialog";
import { PhoneNumberInput } from "@/frontend/components/landing/PhoneNumberInput";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useOrders } from "@/frontend/hooks/useOrders";
import {
  getCanonicalNetworkDisplayName,
  getNetworkInitials,
  getNetworkLogoUrl
} from "@/frontend/lib/networkBranding";
import { formatCurrency } from "@/shared/utils/formatters";
import { useRewards } from "@/frontend/hooks/useRewards";
import { useWallet } from "@/frontend/hooks/useWallet";
import { downloadCsv } from "@/frontend/lib/exportCsv";
import { isValidGhanaPhone } from "@/shared/utils/validators";


const isProviderBalanceFailure = (reason?: string | null) =>
  Boolean(reason && reason.toLowerCase().includes("insufficient balance"));
const getOrderDisplayStatus = (order: { status: string; failedReason?: string | null }) => {
  if (order.status === "FAILED" && isProviderBalanceFailure(order.failedReason)) {
    return "In Progress";
  }
  if (order.status === "COMPLETED") return "Completed";
  if (order.status === "PROCESSING") return "In Progress";
  if (order.status === "PENDING") return "Pending";
  return "Failed";
};

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const { orders, refresh: refreshOrders } = useOrders();
  const { balance, tier, transactions } = useRewards();
  const { balance: walletBalance, addFunds, refresh: refreshWallet, loading: walletLoading } = useWallet();

  const [showReferral, setShowReferral] = useState(false);
  const [referralLink, setReferralLink] = useState("");
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [featuredPlans, setFeaturedPlans] = useState<any[]>([]);
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const [quickBuyPlan, setQuickBuyPlan] = useState<any | null>(null);
  const [quickBuyPhone, setQuickBuyPhone] = useState("");
  const [quickBuyError, setQuickBuyError] = useState<string | null>(null);
  const [quickBuySubmitting, setQuickBuySubmitting] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNotice, setWalletNotice] = useState<string | null>(null);
  const [walletAddSubmitting, setWalletAddSubmitting] = useState(false);
  const [showAgentUpgradeModal, setShowAgentUpgradeModal] = useState(false);
  const [agentUpgradeError, setAgentUpgradeError] = useState<string | null>(null);
  const [agentUpgradeSubmitting, setAgentUpgradeSubmitting] = useState(false);

  const typeLabels: Record<string, string> = {
    EARNED: "Earned (Cashback)",
    SPENT: "Spent on Bundle",
    WITHDRAWN: "Withdrawn (MoMo)",
    EXPIRED: "Expired Rewards",
    ADJUSTED: "Adjusted"
  };

  const statusBadgeForReward = (type: string) => {
    if (type === "WITHDRAWN") return "bg-[#fff6dd] text-[#f59e0b]";
    if (type === "EXPIRED") return "bg-[#fee2e2] text-[#ef4444]";
    return "bg-[#ecfdf3] text-[#16a34a]";
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

  // When returning from Paystack: verify payment and credit wallet, then refresh
  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const urlPayment = params.get("payment");
    const reference = params.get("reference") || params.get("trxref");

    if (urlPayment === "success" && reference) {
      fetch(
        `/api/payments/paystack/verify-return?reference=${encodeURIComponent(reference)}&userId=${encodeURIComponent(user.id)}`
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

    if (urlPayment === "success") {
      refreshOrders();
      refreshWallet();
    }
  }, [user?.id, refreshOrders, refreshWallet]);

  // Note: Paystack webhook handles payment verification automatically
  // Removed Moolre reconcile - we're using Paystack now

  // Hide mobile nav when Add Funds or Quick Buy bottom sheet is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (showWalletModal || quickBuyOpen || showAgentUpgradeModal) {
      document.body.classList.add("hide-mobile-nav");
    } else {
      document.body.classList.remove("hide-mobile-nav");
    }
    return () => {
      document.body.classList.remove("hide-mobile-nav");
    };
  }, [showWalletModal, quickBuyOpen, showAgentUpgradeModal]);

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

  const totalSpent = useMemo(() => {
    return orders
      .filter((order) => order.status === "COMPLETED")
      .reduce((sum, order) => sum + order.amount, 0);
  }, [orders]);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await fetch("/api/data-plans?scope=public&limit=12");
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          setFeaturedPlans([]);
          return;
        }
        const plans = Array.isArray(data) ? data : [];
        const featured = plans.filter((plan) => plan.isFeatured).slice(0, 3);
        const fallback = featured.length > 0 ? featured : plans.slice(0, 3);
        setFeaturedPlans(fallback);
      } catch {
        setFeaturedPlans([]);
      }
    };

    loadPlans();
  }, []);

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
        setWalletNotice(data.error);
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

  const handleQuickBuy = (plan: any) => {
    setQuickBuyPlan(plan);
    setQuickBuyPhone(user?.phoneNumber ?? "");
    setQuickBuyError(null);
    setQuickBuySubmitting(false);
    setQuickBuyOpen(true);
  };

  const handleQuickBuyPay = async () => {
    if (!quickBuyPlan) return;
    if (!isValidGhanaPhone(quickBuyPhone)) {
      setQuickBuyError("Enter a valid Ghana phone number.");
      return;
    }
    if (!user?.id) {
      setQuickBuyError("Please login to continue.");
      return;
    }
    const networkId = quickBuyPlan.networkId ?? quickBuyPlan.network?.id;
    if (!networkId) {
      setQuickBuyError("Network information is missing for this plan.");
      return;
    }

    setQuickBuySubmitting(true);
    setQuickBuyError(null);
    try {
      const amount = Number(quickBuyPlan.price ?? 0);
      const currency = quickBuyPlan.currency ?? "GHS";
      const ref = `ORDER-${user.id}-${Date.now()}`;
      const initRes = await fetch("/api/payments/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount,
          currency,
          ref,
          type: "order",
          networkId,
          dataPlanId: quickBuyPlan.id,
          recipientNumber: quickBuyPhone,
          rewardToUse: 0,
          useWallet: false
        })
      });
      const initData = await initRes.json().catch(() => null);
      if (initData?.error) {
        setQuickBuyError(typeof initData.error === "string" ? initData.error : "Unable to open payment gateway.");
        return;
      }
      if (initData?.paymentUrl) {
        window.location.href = initData.paymentUrl;
        return;
      }
      setQuickBuyError("Unable to open payment page. Please try again.");
    } catch {
      setQuickBuyError("Unable to process payment.");
    } finally {
      setQuickBuySubmitting(false);
    }
  };

  const handleAgentUpgradeProceed = async () => {
    if (!user?.id) {
      setAgentUpgradeError("Please login to continue.");
      return;
    }

    setAgentUpgradeSubmitting(true);
    setAgentUpgradeError(null);
    try {
      const ref = `AGENT-UPGRADE-${user.id}-${Date.now()}`;
      const response = await fetch("/api/payments/paystack/agent-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount: 300,
          currency: "GHS",
          ref
        })
      });
      const data = await response.json().catch(() => null);
      if (data?.error) {
        setAgentUpgradeError(typeof data.error === "string" ? data.error : "Unable to open payment gateway.");
        setAgentUpgradeSubmitting(false);
        return;
      }
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      setAgentUpgradeError("Unable to open payment page. Please try again.");
      setAgentUpgradeSubmitting(false);
    } catch {
      setAgentUpgradeError("Unable to start upgrade payment.");
      setAgentUpgradeSubmitting(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden pb-24 sm:gap-6 md:pb-0">
      <section className="min-w-0 md:hidden">
        <div>
          <p className="text-sm text-slate-500">Welcome back,</p>
          <h1 className="text-2xl font-black text-slate-900">{user?.username ?? "Customer"}</h1>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Link
            href="/dashboard/buy-data"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#0f172a] px-6 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.2)]"
          >
            Buy Data
          </Link>
          <button
            type="button"
            onClick={() => {
              setAgentUpgradeError(null);
              setShowAgentUpgradeModal(true);
            }}
            className="inline-flex h-11 items-center justify-center rounded-full border-2 border-[#0f172a] bg-white px-6 text-sm font-semibold text-[#0f172a] shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
          >
            Agent
          </button>
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
              <p className="text-xs font-semibold uppercase text-white/70">Loyalty Rewards</p>
              <h2 className="mt-2 text-2xl font-black">
                {formatCurrency(balance.currentBalance, "GHS")}
              </h2>
              <p className="mt-1 text-xs text-white/70">Available Balance</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                <path d="M16 7V5a2 2 0 0 0-2-2H5" />
                <path d="M16 12h4" />
              </svg>
            </div>
          </div>
          <button className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[#0f172a]">
            Redeem Now
          </button>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Quick Buy</h2>
            <Link href="/dashboard/buy-data" className="text-xs font-semibold text-[#2563eb]">
              View all plans
            </Link>
          </div>
          <div className="mt-3 grid gap-3">
            {featuredPlans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                No featured plans yet.
              </div>
            ) : (
              featuredPlans.map((plan) => {
                const networkNameRaw = plan.network?.displayName ?? plan.network?.name ?? "Network";
                const networkName = getCanonicalNetworkDisplayName(networkNameRaw) || networkNameRaw;
                const networkLogo = getNetworkLogoUrl(networkNameRaw, plan.network?.logoUrl);
                const description = networkName;
                return (
                  <div
                    key={plan.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                          {networkLogo ? (
                            <Image
                              src={networkLogo}
                              alt={networkName}
                              width={28}
                              height={28}
                              className="h-7 w-7 object-contain"
                            />
                          ) : (
                            <span className="text-[10px] font-bold text-slate-700">{getNetworkInitials(networkNameRaw)}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {plan.dataAmount ?? plan.name}
                          </p>
                          <p className="text-xs text-slate-500">{description}</p>
                        </div>
                      </div>
                      <button
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] text-white"
                        onClick={() => handleQuickBuy(plan)}
                        aria-label={`Buy ${plan.dataAmount ?? plan.name}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="9" cy="21" r="1" />
                          <circle cx="20" cy="21" r="1" />
                          <path d="M5 6h2l1 9h10l2-7H8" />
                          <path d="M9 10h8" />
                        </svg>
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">
                        {formatCurrency(plan.price, plan.currency ?? "GHS")}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-600">No Expiry</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Recent Orders</h2>
          <button className="text-xs font-semibold text-[#2563eb]">View All</button>
        </div>

        <div className="mt-3 space-y-3">
          {mobileOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              No recent orders yet.
            </div>
          ) : (
            mobileOrders.map((order) => (
              <div key={`${order.plan}-${order.price}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {order.networkLogo ? (
                      <Image
                        src={order.networkLogo}
                        alt={order.network}
                        width={32}
                        height={32}
                        className="h-8 w-8 object-contain"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-700">{order.networkInitials}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{order.plan}</p>
                    <p className="text-xs text-slate-500">{order.price}</p>
                  </div>
                  <button className="rounded-full bg-[#e7efff] px-3 py-1 text-xs font-semibold text-[#2563eb]">
                    Buy Again
                  </button>
                </div>
                <p className={`mt-2 text-xs font-semibold ${order.badge}`}>{order.status}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 grid min-w-0 grid-cols-2 gap-3 sm:gap-4">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7efff] text-[#2563eb]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3v18h18" />
                <path d="M7 13l3 3 7-7" />
              </svg>
            </div>
            <p className="mt-3 text-xs text-slate-500">Total Spent</p>
            <p className="text-base font-bold text-slate-900">{formatCurrency(totalSpent, "GHS")}</p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ecfdf3] text-[#16a34a]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <p className="mt-3 text-xs text-slate-500">Orders</p>
            <p className="text-base font-bold text-slate-900">{orders.length} Items</p>
          </div>
        </div>
      </section>

      <div className="hidden md:flex md:flex-col md:gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Customer Rewards</h1>
            <p className="text-sm text-slate-500">
              Track and manage your Keldatagh earnings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setAgentUpgradeError(null);
                setShowAgentUpgradeModal(true);
              }}
              className="rounded-full border-2 border-[#0f172a] bg-white px-6 py-2.5 text-sm font-semibold text-[#0f172a] shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
            >
              Agent
            </button>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a] text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                <path d="M16 7V5a2 2 0 0 0-2-2H5" />
                <path d="M16 12h4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Wallet Balance</p>
              <p className="text-base font-bold text-slate-900">
                {walletLoading ? "..." : formatCurrency(walletBalance.currentBalance, "GHS")}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white"
              onClick={() => setShowWalletModal(true)}
            >
              Add Funds
            </button>
            </div>
          </div>
        </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl bg-[var(--accent)] p-8 text-[#0f172a] shadow-[0_18px_40px_rgba(var(--accent-rgb)/0.35)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0f172a]/70">
            Available Rewards Balance
          </p>
          <h2 className="mt-2 text-4xl font-black">{formatCurrency(balance.currentBalance, "GHS")}</h2>
          <p className="mt-3 max-w-md text-sm text-[#0f172a]/80">
            You&apos;ve earned this from referrals and high-volume purchases.
            Keep it up!
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#0f172a] shadow-sm">
              Withdraw Funds
            </button>
            <button
              className="rounded-full border border-white/60 px-5 py-2 text-sm font-semibold text-[#0f172a]"
              type="button"
              onClick={async () => {
                setShowReferral(true);
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
              }}
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
            You are in the top 5% of users this month.
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
      </div>

      <Dialog open={showReferral} onClose={() => setShowReferral(false)} mobileBottomSheet>
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
              onClick={() => setShowReferral(false)}
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
                <input
                  value={referralLoading ? "Generating link..." : referralLink}
                  readOnly
                  className="w-full flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                />
                <button
                  type="button"
                  className="rounded-xl bg-[#0f172a] px-4 py-3 text-sm font-semibold text-white"
                  onClick={async () => {
                    if (!referralLink) return;
                    await navigator.clipboard.writeText(referralLink);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      <Dialog open={quickBuyOpen} onClose={() => setQuickBuyOpen(false)} mobileBottomSheet>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Quick Buy</h3>
              <p className="mt-1 text-sm text-slate-500">
                {quickBuyPlan
                  ? `${quickBuyPlan.dataAmount ?? quickBuyPlan.name ?? "Plan"} • ${
                      quickBuyPlan.network?.displayName ??
                      quickBuyPlan.network?.name ??
                      "Network"
                    }`
                  : "Select a plan to continue."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQuickBuyOpen(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {quickBuyError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {quickBuyError}
            </div>
          ) : null}

          <div className="mt-5">
            <PhoneNumberInput
              value={quickBuyPhone}
              onChange={(value) => {
                setQuickBuyPhone(value);
                setQuickBuyError(null);
              }}
              error={quickBuyError}
            />
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
              onClick={() => setQuickBuyOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white"
              onClick={handleQuickBuyPay}
              type="button"
              disabled={quickBuySubmitting}
            >
              {quickBuySubmitting ? "Processing..." : "Pay Now"}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog open={showWalletModal} onClose={() => { if (!walletAddSubmitting) setShowWalletModal(false); }} mobileBottomSheet>
        <div className="p-6">
          {walletAddSubmitting ? (
            <div className="flex flex-col items-center py-8">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#0f172a]" />
              </div>
              <p className="mt-5 text-sm font-semibold text-slate-900">Processing payment...</p>
              <p className="mt-2 text-xs text-slate-500 text-center">
                Opening the Paystack checkout page. Please wait.
              </p>
            </div>
          ) : (
            <>
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
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {walletNotice ? (
                <p
                  className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                    walletNotice.startsWith("Enter") || walletNotice.startsWith("Unable")
                      ? "border border-red-200 bg-red-50 text-red-700"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {walletNotice}
                </p>
              ) : null}

              <div className="mt-5">
                <label className="text-sm font-semibold text-slate-700">Amount (GHS)</label>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                    GH₵
                  </span>
                  <input
                    value={walletAmount}
                    onChange={(event) => setWalletAmount(event.target.value)}
                    placeholder="50.00"
                    type="number"
                    min="1"
                    step="any"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm text-slate-800 outline-none focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <p className="text-xs text-blue-700">
                  You will be redirected to Paystack to complete the payment.
                </p>
              </div>

              <button
                type="button"
                className="mt-5 w-full rounded-xl bg-[#0f172a] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1e293b] active:scale-[0.98] disabled:opacity-70"
                onClick={handleWalletAddFunds}
                disabled={walletAddSubmitting}
              >
                Pay Now
              </button>
            </>
          )}
        </div>
      </Dialog>

      <Dialog
        open={showAgentUpgradeModal}
        onClose={() => {
          if (!agentUpgradeSubmitting) setShowAgentUpgradeModal(false);
        }}
        mobileBottomSheet
      >
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Upgrade to Agent</h3>
              <p className="mt-1 text-sm text-slate-500">One-time activation fee: GH₵300.00</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!agentUpgradeSubmitting) setShowAgentUpgradeModal(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-[#f8fafc] p-4">
            <p className="text-sm font-semibold text-slate-900">Benefits</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
                Cheap data prices
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
                Get API access
              </li>
            </ul>
          </div>

          {agentUpgradeError ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {agentUpgradeError}
            </p>
          ) : null}

          <button
            type="button"
            className="mt-5 w-full rounded-xl bg-[#0f172a] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1e293b] active:scale-[0.98] disabled:opacity-70"
            onClick={handleAgentUpgradeProceed}
            disabled={agentUpgradeSubmitting}
          >
            {agentUpgradeSubmitting ? "Opening Paystack..." : "Proceed"}
          </button>
        </div>
      </Dialog>

      <section className="hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)] md:block">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">Quick Buy</h2>
          <Link href="/dashboard/buy-data" className="text-sm font-semibold text-[#2563eb]">
            View all plans
          </Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featuredPlans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              No featured plans yet.
            </div>
          ) : (
            featuredPlans.map((plan) => {
              const tag = plan.isFeatured ? "POPULAR" : "PLAN";
              const badge = plan.isFeatured
                ? "bg-[#fff7db] text-[#b45309]"
                : "bg-[#e7f3ff] text-[#2563eb]";
              const networkNameRaw = plan.network?.displayName ?? plan.network?.name ?? "Network";
              const networkName = getCanonicalNetworkDisplayName(networkNameRaw) || networkNameRaw;
              const networkLogo = getNetworkLogoUrl(networkNameRaw, plan.network?.logoUrl);
              const description = networkName;
              return (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_20px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                      {networkLogo ? (
                        <Image
                          src={networkLogo}
                          alt={networkName}
                          width={32}
                          height={32}
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        <span className="text-xs font-bold text-slate-700">{getNetworkInitials(networkNameRaw)}</span>
                      )}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${badge}`}>
                      {tag}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-base font-bold text-slate-900">{plan.dataAmount ?? plan.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{description}</p>
                  </div>
                  <p className="mt-2 text-[10px] font-semibold text-emerald-600">No Expiry</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">
                      {formatCurrency(plan.price, plan.currency ?? "GHS")}
                    </span>
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] text-white"
                      onClick={() => handleQuickBuy(plan)}
                      aria-label={`Buy ${plan.dataAmount ?? plan.name}`}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="9" cy="21" r="1" />
                        <circle cx="20" cy="21" r="1" />
                        <path d="M5 6h2l1 9h10l2-7H8" />
                        <path d="M9 10h8" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)] md:block">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Transaction History</h2>
            <p className="text-sm text-slate-500">
              Recent reward activity and withdrawals.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
              Filter
            </button>
            <button
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              onClick={() => {
                const rows = transactions.map((item) => ({
                  Date: `${formatDate(item.createdAt)} ${formatTime(item.createdAt)}`.trim(),
                  Type: typeLabels[item.type] ?? item.description,
                  Reference: item.referenceNumber ?? "",
                  Amount:
                    item.type === "EARNED" || item.type === "ADJUSTED"
                      ? `+${item.amount.toFixed(2)}`
                      : `-${item.amount.toFixed(2)}`,
                  Status:
                    item.type === "WITHDRAWN"
                      ? "Processing"
                      : item.type === "EXPIRED"
                      ? "Expired"
                      : "Completed"
                }));
                downloadCsv("rewards-history.csv", rows, [
                  "Date",
                  "Type",
                  "Reference",
                  "Amount",
                  "Status"
                ]);
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
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">Order / Ref</th>
                <th className="px-6 py-3 text-left">Amount (GHS)</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                    No reward transactions yet.
                  </td>
                </tr>
              ) : (
                transactions.map((item) => {
                  const label = typeLabels[item.type] ?? item.description;
                  const statusLabel =
                    item.type === "WITHDRAWN" ? "Processing" : item.type === "EXPIRED" ? "Expired" : "Completed";
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
                      <td className="px-6 py-4 text-[var(--accent)]">{item.referenceNumber ?? "—"}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {signedAmount}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeForReward(item.type)}`}>
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
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
          <span>Showing 1-4 of 128 transactions</span>
          <div className="flex items-center gap-2">
            <button className="h-8 w-8 rounded-full border border-slate-200 text-xs font-semibold text-slate-600">1</button>
            <button className="h-8 w-8 rounded-full border border-slate-200 text-xs font-semibold text-slate-600">2</button>
            <button className="h-8 w-8 rounded-full border border-slate-200 text-xs font-semibold text-slate-600">3</button>
          </div>
        </div>
      </section>
    </div>
  );
}
