"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Signal, Star } from "lucide-react";
import Image from "next/image";
import { Dialog } from "@/frontend/components/ui/dialog";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useDataPlans } from "@/frontend/hooks/useDataPlans";
import { useNetworks } from "@/frontend/hooks/useNetworks";
import { useRewards } from "@/frontend/hooks/useRewards";
import { useWallet } from "@/frontend/hooks/useWallet";
import { useTheme } from "@/frontend/providers/ThemeProvider";
import type { DataPlan, Network } from "@/shared/types";
import { formatCurrency, formatGhanaPhone } from "@/shared/utils/formatters";
import { isValidGhanaPhone } from "@/shared/utils/validators";

const NETWORK_CARD_CONFIG = [
  {
    key: "mtn",
    label: "MTN",
    icon: "/images/networks/MTN-Logo.png",
    matchers: ["mtn"],
  },
  {
    key: "telecel",
    label: "TELECEL",
    icon: "/images/networks/Telecel.webp",
    matchers: ["telecel", "vodafone"],
  },
  {
    key: "airteltigo",
    label: "AIRTELTIGO",
    icon: "/images/networks/airteltigo.png",
    matchers: ["airteltigo", "airtel", "tigo"],
  },
] as const;

type DataBundleNetworkKey = typeof NETWORK_CARD_CONFIG[number]["key"];

const normalizeName = (value?: string | null) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const resolveNetworkKeyFromText = (value?: string | null): DataBundleNetworkKey | null => {
  const normalized = String(value || "").toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("mtn")) return "mtn";
  if (normalized.includes("telecel") || normalized.includes("vodafone")) return "telecel";
  if (
    normalized.includes("airteltigo") ||
    normalized.includes("airtel tigo") ||
    normalized.includes("airtel") ||
    normalized.includes("tigo")
  ) {
    return "airteltigo";
  }
  return null;
};

const digitsOnly = (value: string) => value.replace(/\D/g, "");

export default function BuyDataPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { networks } = useNetworks();
  const { accent, primary } = useTheme();
  const [selectedNetworkKey, setSelectedNetworkKey] = useState<DataBundleNetworkKey | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const { plans } = useDataPlans(selectedNetwork?.id, selectedNetwork?.name);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [applyRewards, setApplyRewards] = useState(false);
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNotice, setWalletNotice] = useState<string | null>(null);
  const [walletAddSubmitting, setWalletAddSubmitting] = useState(false);

  const { balance: rewardsBalance, refresh: refreshRewards } = useRewards();
  const { balance: walletBalance, refresh: refreshWallet, loading: walletLoading } = useWallet();

  const quickPlanId = useMemo(() => searchParams.get("planId"), [searchParams]);
  const quickNetworkId = useMemo(() => searchParams.get("networkId"), [searchParams]);
  const quickPhone = useMemo(() => searchParams.get("phone"), [searchParams]);

  const rewardEligible = rewardsBalance.currentBalance >= 50;
  const rewardToApply = useMemo(() => {
    if (!selectedPlan || !applyRewards || !rewardEligible) return 0;
    return Math.min(rewardsBalance.currentBalance, selectedPlan.price);
  }, [applyRewards, rewardEligible, rewardsBalance.currentBalance, selectedPlan]);

  const payableAmount = useMemo(() => {
    if (!selectedPlan) return 0;
    return Math.max(0, selectedPlan.price - rewardToApply);
  }, [rewardToApply, selectedPlan]);

  const phoneError =
    phoneNumber.trim().length > 0 && !isValidGhanaPhone(phoneNumber)
      ? "Enter a valid Ghana phone number"
      : null;

  const primaryColor = accent || primary || "#f5c63d";

  const primaryRgb = useMemo(() => {
    const fallback = { r: 245, g: 198, b: 61 };
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(primaryColor || "");
    if (!match) return fallback;
    return {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16),
    };
  }, [primaryColor]);
  const primaryRgba = (alpha: number) => `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${alpha})`;

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("theme5-manrope-font")) return;
    const link = document.createElement("link");
    link.id = "theme5-manrope-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    if (!rewardEligible) setApplyRewards(false);
  }, [rewardEligible]);

  const networkCards = useMemo(() => {
    return NETWORK_CARD_CONFIG.map((card) => {
      const matchedNetwork = networks.find((network) => {
        const normalized = normalizeName(network.name);
        return card.matchers.some((matcher) => normalized.includes(matcher));
      });

      const networkPlans = plans.filter((plan) => {
        if (!matchedNetwork) return false;
        return plan.networkId === matchedNetwork.id;
      });

      return {
        ...card,
        networkId: matchedNetwork?.id || null,
        networkName: matchedNetwork?.name || card.label,
        packageCount: networkPlans.length,
      };
    });
  }, [networks, plans]);

  useEffect(() => {
    if (selectedNetworkKey) {
      const card = networkCards.find((c) => c.key === selectedNetworkKey);
      if (card?.networkId) {
        const network = networks.find((n) => n.id === card.networkId);
        if (network) setSelectedNetwork(network);
      }
    }
  }, [selectedNetworkKey, networkCards, networks]);

  useEffect(() => {
    if (!quickNetworkId || selectedNetwork || networks.length === 0) return;
    const match = networks.find((network) => network.id === quickNetworkId);
    if (match) {
      setSelectedNetwork(match);
      const key = resolveNetworkKeyFromText(match.name);
      if (key) setSelectedNetworkKey(key);
    }
  }, [networks, quickNetworkId, selectedNetwork]);

  useEffect(() => {
    if (!quickPlanId || !plans.length) return;
    if (selectedPlan?.id === quickPlanId) return;
    const match = plans.find((plan) => plan.id === quickPlanId);
    if (match) setSelectedPlan(match);
  }, [plans, quickPlanId, selectedPlan]);

  useEffect(() => {
    if (!quickPhone || phoneNumber) return;
    setPhoneNumber(formatGhanaPhone(quickPhone));
  }, [phoneNumber, quickPhone]);

  useEffect(() => {
    if (selectedNetworkKey && networkCards.some((card) => card.key === selectedNetworkKey)) return;
    const firstWithPackages = networkCards.find((card) => card.packageCount > 0);
    if (firstWithPackages) {
      setSelectedNetworkKey(firstWithPackages.key);
      return;
    }
    if (networkCards[0]) {
      setSelectedNetworkKey(networkCards[0].key);
    }
  }, [networkCards, selectedNetworkKey]);

  const selectedNetworkCard = useMemo(
    () => networkCards.find((card) => card.key === selectedNetworkKey) || null,
    [networkCards, selectedNetworkKey]
  );

  const filteredPlans = useMemo(() => {
    if (!selectedNetworkCard?.networkId) return [];
    return plans.filter((plan) => plan.networkId === selectedNetworkCard.networkId && plan.isActive);
  }, [selectedNetworkCard, plans]);

  useEffect(() => {
    if (filteredPlans.length === 0) {
      setSelectedPlan(null);
      return;
    }
    setSelectedPlan((current) => {
      if (current && filteredPlans.some((plan) => plan.id === current.id)) return current;
      return filteredPlans[0];
    });
  }, [filteredPlans]);

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

  const selectedNetworkName = selectedNetworkCard?.networkName || selectedNetwork?.name || "Select network";
  const selectedBundleName = selectedPlan?.name || "Select package";
  const totalCharge = selectedPlan?.price || 0;

  const handlePayNow = async () => {
    if (!user?.id) {
      setError("Please login to continue.");
      return;
    }
    if (!selectedNetwork || !selectedPlan || !isValidGhanaPhone(phoneNumber)) {
      setError("Select network, plan and valid phone number.");
      return;
    }

    setIsPaying(true);
    setError(null);

    if (useWalletBalance) {
      if (walletBalance.currentBalance < payableAmount) {
        setError("Insufficient wallet balance.");
        setIsPaying(false);
        return;
      }
      try {
        const orderResponse = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            networkId: selectedNetwork.id,
            dataPlanId: selectedPlan.id,
            recipientNumber: digitsOnly(phoneNumber),
            rewardToUse: rewardToApply,
            useWallet: true
          })
        });
        const orderData = await orderResponse.json().catch(() => null);
        if (!orderResponse.ok) {
          setError(orderData?.error ?? "Unable to create order.");
          setIsPaying(false);
          return;
        }
        await refreshRewards();
        await refreshWallet();
        router.push("/orders");
      } catch {
        setError("Unable to create order.");
      } finally {
        setIsPaying(false);
      }
      return;
    }

    const ref = `ORDER-${user.id}-${Date.now()}`;
    try {
      const response = await fetch("/api/payments/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount: payableAmount,
          currency: selectedPlan.currency ?? "GHS",
          ref,
          type: "order",
          networkId: selectedNetwork.id,
          dataPlanId: selectedPlan.id,
          recipientNumber: digitsOnly(phoneNumber),
          rewardToUse: rewardToApply,
          useWallet: false
        })
      });
      const data = await response.json().catch(() => null);
      if (data?.error) {
        setError(typeof data.error === "string" ? data.error : "Unable to open payment gateway.");
        setIsPaying(false);
        return;
      }
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      setError("Unable to open payment page. Please try again.");
    } catch {
      setError("Unable to process payment.");
    } finally {
      setIsPaying(false);
    }
  };

  const handleAddFunds = async () => {
    const amount = Number(walletAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !user?.id) {
      setWalletNotice("Enter a valid amount.");
      return;
    }

    setWalletAddSubmitting(true);
    setWalletNotice(null);
    try {
      const ref = `WALLET-${user.id}-${Date.now()}`;
      const response = await fetch("/api/payments/paystack/initialize", {
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
    } catch {
      setWalletNotice("Unable to open payment gateway.");
    } finally {
      setWalletAddSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#f5f3ef] text-[#1f1a12]"
      style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}
    >
      <style>{`
        .theme5-surface {
          box-shadow: 0 22px 50px rgba(24, 18, 8, 0.08);
        }
        .theme5-grid-glow {
          background-image: radial-gradient(circle at 15% 10%, rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.22), transparent 40%);
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-8 md:px-6 md:pb-14 md:pt-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-[#ddd4c6] bg-white px-4 py-2 text-sm font-semibold text-[#443c30] transition-colors hover:bg-[#ebe6dc]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back to Dashboard
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-[#ddd4c6] bg-white px-4 py-2 text-sm font-semibold text-[#443c30] transition-colors hover:bg-[#ebe6dc]"
            onClick={() => setShowWalletModal(true)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
              <path d="M16 7V5a2 2 0 0 0-2-2H5" />
              <path d="M16 12h4" />
            </svg>
            {walletLoading ? "Loading..." : formatCurrency(walletBalance.currentBalance, "GHS")}
          </button>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
          <div>
            <h2 className="text-[44px] font-extrabold leading-[1.04] tracking-[-0.02em] text-[#17120b]">Network</h2>
            <p className="mt-3 text-[#6f6557]">Select a network to load only its assigned data packages.</p>

            <div className="mt-8 grid grid-cols-3 gap-2 md:gap-4">
              {networkCards.map((card) => {
                const isSelected = selectedNetworkKey === card.key;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setSelectedNetworkKey(card.key)}
                    className={`rounded-xl border bg-white p-2 text-center transition-all md:rounded-2xl md:p-4 ${
                      isSelected ? "shadow-sm" : "hover:border-[#d6c9b3]"
                    }`}
                    style={{
                      borderColor: isSelected ? primaryColor : "#e8dfd2",
                      backgroundColor: isSelected ? primaryRgba(0.08) : "#ffffff",
                    }}
                  >
                    <div className="flex justify-center">
                      <Image
                        src={card.icon}
                        alt={card.label}
                        width={120}
                        height={40}
                        loading="lazy"
                        className="h-8 w-auto max-w-[68px] object-contain md:h-10 md:max-w-[120px]"
                      />
                    </div>
                    <h3 className="mt-2 text-center text-[10px] font-extrabold leading-tight text-[#1b170f] md:mt-3 md:text-sm">
                      {card.label}
                    </h3>
                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#8f836f] md:mt-2 md:text-[11px]">
                      {card.packageCount} package{card.packageCount === 1 ? "" : "s"}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-[#e8dfd2] bg-white p-4 sm:p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8f836f]">
                Recipient&apos;s Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="e.g. 054 123 4567"
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
                  phoneError ? "border-red-300 bg-red-50" : "border-[#e1d8ca] bg-[#fbfaf8]"
                } focus:border-[${primaryColor}]`}
                style={{ ["--theme5-primary" as any]: primaryColor } as React.CSSProperties}
              />
              {phoneError && (
                <p className="mt-2 text-xs text-red-600">{phoneError}</p>
              )}

              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-[#8f836f]">Choose Data Package</p>
              {filteredPlans.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {filteredPlans.map((plan) => {
                    const selected = selectedPlan?.id === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlan(plan)}
                        className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-left"
                        style={{
                          borderColor: selected ? primaryColor : "#e5ddcf",
                          backgroundColor: selected ? primaryRgba(0.08) : "#ffffff",
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-[#1d180f]">{plan.name}</span>
                          <span className="block truncate text-xs text-[#8f836f]">{plan.dataAmount || plan.name}</span>
                        </span>
                        <span className="ml-3 text-sm font-extrabold" style={{ color: selected ? primaryColor : "#1d180f" }}>
                          {formatCurrency(plan.price, plan.currency || "GHS")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-[#e5ddcf] bg-[#fbfaf8] px-4 py-4 text-sm text-[#746b5e]">
                  No data packages are assigned to this network yet.
                </div>
              )}
            </div>
          </div>

          <aside className="w-full overflow-hidden self-start rounded-2xl bg-[#1a140b] p-4 text-white shadow-[0_18px_42px_rgba(0,0,0,0.3)] sm:p-5">
            <h3 className="text-lg font-bold sm:text-xl">Order Summary</h3>
            <dl className="mt-4 space-y-3 text-xs sm:mt-5 sm:text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-white/70">Network</dt>
                <dd className="truncate text-right font-semibold">{selectedNetworkName}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-white/70">Bundle</dt>
                <dd className="truncate text-right font-semibold">{selectedBundleName}</dd>
              </div>
              {rewardToApply > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-white/70">Rewards Applied</dt>
                  <dd className="font-semibold text-green-400">-{formatCurrency(rewardToApply, selectedPlan?.currency || "GHS")}</dd>
                </div>
              )}
              {useWalletBalance && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-white/70">Wallet Balance</dt>
                  <dd className="font-semibold">{formatCurrency(walletBalance.currentBalance, "GHS")}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <dt className="text-white/70">Service Fee</dt>
                <dd className="font-semibold">{formatCurrency(0, selectedPlan?.currency || "GHS")}</dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-white/15 pt-4">
              <p className="text-sm text-white/70">Total Pay</p>
              <p className="text-[28px] font-extrabold leading-none sm:text-[34px]" style={{ color: primaryColor }}>
                {formatCurrency(payableAmount, selectedPlan?.currency || "GHS")}
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/90">
                <input
                  type="checkbox"
                  checked={useWalletBalance}
                  onChange={(event) => setUseWalletBalance(event.target.checked)}
                  className="rounded"
                />
                Use Wallet ({formatCurrency(walletBalance.currentBalance, "GHS")})
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/90">
                <input
                  type="checkbox"
                  checked={applyRewards}
                  disabled={!rewardEligible}
                  onChange={(event) => setApplyRewards(event.target.checked)}
                  className="rounded"
                />
                Use Rewards ({formatCurrency(rewardsBalance.currentBalance, "GHS")})
              </label>
            </div>

            {error ? (
              <div className="mt-3 rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handlePayNow}
              disabled={!selectedPlan || isPaying}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-[#16120a] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: primaryColor }}
            >
              {isPaying ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {isPaying
                ? "Processing Payment..."
                : `Pay ${formatCurrency(payableAmount, selectedPlan?.currency ?? "GHS")}`}
            </button>

            <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
              Encrypted via Secure Payment
            </p>
          </aside>
        </section>
      </div>

      <Dialog open={showWalletModal} onClose={() => setShowWalletModal(false)} mobileBottomSheet>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900">Add Wallet Funds</h3>
          <p className="mt-1 text-sm text-slate-500">You will be redirected to Paystack to complete payment.</p>
          {walletNotice ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {walletNotice}
            </p>
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
            className="mt-5 w-full rounded-xl bg-[#0f172a] px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
            onClick={handleAddFunds}
            disabled={walletAddSubmitting}
          >
            {walletAddSubmitting ? "Please wait..." : "Add Funds"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
