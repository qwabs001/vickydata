"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Lock, Signal, Star, Wallet } from "lucide-react";
import { Dialog } from "@/frontend/components/ui/dialog";
import { getCanonicalNetworkDisplayName, getNetworkLogoUrl } from "@/frontend/lib/networkBranding";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useDataPlans } from "@/frontend/hooks/useDataPlans";
import { useNetworks } from "@/frontend/hooks/useNetworks";
import { useRewards } from "@/frontend/hooks/useRewards";
import { useTheme } from "@/frontend/providers/ThemeProvider";
import { useWallet } from "@/frontend/hooks/useWallet";
import type { DataPlan, Network } from "@/shared/types";
import { formatCurrency, formatGhanaPhone } from "@/shared/utils/formatters";
import { isValidGhanaPhone } from "@/shared/utils/validators";

const digitsOnly = (value: string) => value.replace(/\D/g, "");

export default function BuyDataPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { networks } = useNetworks();
  const { accent, primary } = useTheme();
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const { plans, loading: plansLoading } = useDataPlans(selectedNetwork?.id, selectedNetwork?.name);
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
  const activePlans = useMemo(() => plans.filter((plan) => plan.isActive), [plans]);

  const primaryColor = accent || primary || "#f5c63d";
  const primaryRgb = useMemo(() => {
    const fallback = { r: 245, g: 198, b: 61 };
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(primaryColor || "");
    if (!match) return fallback;
    return {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16)
    };
  }, [primaryColor]);
  const primaryRgba = (alpha: number) => `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${alpha})`;

  const rewardEligible = rewardsBalance.currentBalance >= 50;
  const rewardToApply = useMemo(() => {
    if (!useWalletBalance || !selectedPlan || !applyRewards || !rewardEligible) return 0;
    return Math.min(rewardsBalance.currentBalance, selectedPlan.price);
  }, [useWalletBalance, applyRewards, rewardEligible, rewardsBalance.currentBalance, selectedPlan]);

  const payableAmount = useMemo(() => {
    if (!selectedPlan) return 0;
    return Math.max(0, selectedPlan.price - rewardToApply);
  }, [rewardToApply, selectedPlan]);

  const phoneError =
    phoneNumber.trim().length > 0 && !isValidGhanaPhone(phoneNumber)
      ? "Enter a valid Ghana phone number"
      : null;

  useEffect(() => {
    if (!rewardEligible) setApplyRewards(false);
  }, [rewardEligible]);

  useEffect(() => {
    if (selectedNetwork || networks.length === 0) return;
    const match = quickNetworkId ? networks.find((network) => network.id === quickNetworkId) : null;
    setSelectedNetwork(match || networks[0] || null);
  }, [networks, quickNetworkId, selectedNetwork]);

  useEffect(() => {
    if (!activePlans.length) {
      setSelectedPlan(null);
      return;
    }

    if (quickPlanId) {
      if (selectedPlan?.id === quickPlanId) return;
      const match = activePlans.find((plan) => plan.id === quickPlanId);
      if (match) {
        setSelectedPlan(match);
        return;
      }
    }

    setSelectedPlan((current) => {
      if (current && activePlans.some((plan) => plan.id === current.id)) return current;
      return activePlans[0];
    });
  }, [activePlans, quickPlanId, selectedPlan]);

  useEffect(() => {
    if (!quickPhone || phoneNumber) return;
    setPhoneNumber(formatGhanaPhone(quickPhone));
  }, [phoneNumber, quickPhone]);

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

  const selectedNetworkName =
    getCanonicalNetworkDisplayName(selectedNetwork?.displayName || selectedNetwork?.name) ||
    selectedNetwork?.displayName ||
    selectedNetwork?.name ||
    "Select network";

  const selectedBundleName = selectedPlan?.dataAmount || selectedPlan?.name || "Select package";

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
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.id
          },
          body: JSON.stringify({
            userId: user.id,
            networkId: selectedNetwork.id,
            dataPlanId: selectedPlan.id,
            recipientNumber: digitsOnly(phoneNumber),
            rewardToUse: rewardToApply,
            useWallet: true,
          }),
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
      const response = await fetch("/api/payments/initialize", {
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
          useWallet: false,
        }),
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
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount,
          currency: "GHS",
          ref,
          type: "wallet",
        }),
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
    <div className="min-h-full bg-[#f5f3ef] text-[#1f1a12]">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-4 md:px-6 md:pb-10 md:pt-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-[#e7dfd2] bg-white px-4 py-2 text-sm font-semibold text-[#1a150e]"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-[#e7dfd2] bg-white px-4 py-2 text-sm font-semibold text-[#1a150e]"
            onClick={() => setShowWalletModal(true)}
          >
            <Wallet size={16} />
            {walletLoading ? "Loading..." : formatCurrency(walletBalance.currentBalance, "GHS")}
          </button>
        </div>

        <section className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="rounded-[26px] bg-[radial-gradient(circle_at_15%_10%,rgba(245,198,61,0.22),transparent_40%)] p-1">
            <div className="rounded-[22px] p-5 sm:p-7">
              <h1 className="text-[38px] font-extrabold leading-[1.04] tracking-[-0.02em] text-[#19140c] sm:text-[54px]">
                Fast, Reliable
                <br />
                <span style={{ color: primaryColor }}>Data Bundles</span>
                <br />
                for Ghana.
              </h1>
              <p className="mt-4 max-w-[470px] text-sm text-[#6f6557] sm:text-base">
                Select your network, choose a bundle, and complete checkout in seconds.
              </p>
            </div>
          </div>

          <div className="rounded-[26px] border border-[#e7dfd2] bg-[#f8f7f4] p-4 sm:p-6">
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold text-[#5a4e31]"
              style={{ borderColor: primaryRgba(0.35), backgroundColor: primaryRgba(0.12) }}
            >
              <Star size={12} className="fill-current" style={{ color: primaryColor }} />
              Wallet ready
            </div>

            <div className="rounded-2xl bg-[#181308] p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/70">Selected Bundle</p>
              <div className="mt-2 flex items-end justify-between">
                <span className="max-w-[68%] truncate text-[24px] font-extrabold leading-none">{selectedBundleName}</span>
                <span className="mb-1 text-base font-bold">
                  {formatCurrency(payableAmount, selectedPlan?.currency || "GHS")}
                </span>
              </div>
              <div className="mt-5 h-[6px] w-full overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full"
                  style={{ width: selectedPlan ? "72%" : "15%", backgroundColor: primaryColor }}
                />
              </div>
              <div className="mt-2 text-right text-xs font-semibold text-white/70">{selectedNetworkName}</div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#ece5d8] bg-white px-4 py-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ color: primaryColor, backgroundColor: primaryRgba(0.2) }}
                >
                  <Signal size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#8f836f]">{selectedNetworkName}</p>
                  <p className="text-sm font-bold text-[#211b12]">{selectedBundleName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-extrabold text-[#09a54e]">
                  {formatCurrency(walletBalance.currentBalance, "GHS")}
                </p>
                <p className="text-xs text-[#8f836f]">Wallet Balance</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.5fr_0.85fr]">
          <div>
            <h2 className="text-[38px] font-extrabold leading-[1.06] tracking-[-0.02em] text-[#17120b] sm:text-[44px]">
              Network
            </h2>
            <p className="mt-3 text-[#6f6557]">Select a network to load only its assigned data packages.</p>

            <div className="mt-7 grid grid-cols-3 gap-2 md:gap-4">
              {networks.map((network) => {
                const isSelected = selectedNetwork?.id === network.id;
                const displayName =
                  getCanonicalNetworkDisplayName(network.displayName || network.name) ||
                  network.displayName ||
                  network.name;
                const logoUrl = getNetworkLogoUrl(displayName, network.logoUrl) || "/images/networks/MTN-Logo.png";

                return (
                  <button
                    key={network.id}
                    type="button"
                    onClick={() => {
                      setSelectedNetwork(network);
                      setSelectedPlan(null);
                    }}
                    className="rounded-xl border bg-white p-2 text-center transition-all md:rounded-2xl md:p-4"
                    style={{
                      borderColor: isSelected ? primaryColor : "#e8dfd2",
                      backgroundColor: isSelected ? primaryRgba(0.08) : "#ffffff"
                    }}
                  >
                    <div className="flex justify-center">
                      <Image
                        src={logoUrl}
                        alt={displayName}
                        width={120}
                        height={40}
                        loading="lazy"
                        className="h-8 w-auto max-w-[68px] object-contain md:h-10 md:max-w-[120px]"
                      />
                    </div>
                    <h3 className="mt-2 text-center text-[10px] font-extrabold leading-tight text-[#1b170f] md:mt-3 md:text-sm">
                      {displayName.toUpperCase()}
                    </h3>
                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#8f836f] md:mt-2 md:text-[11px]">
                      {isSelected ? activePlans.length : ""} {isSelected ? `package${activePlans.length === 1 ? "" : "s"}` : ""}
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
                onChange={(event) => setPhoneNumber(formatGhanaPhone(event.target.value))}
                placeholder="e.g. 054 123 4567"
                className="w-full rounded-xl border border-[#e1d8ca] bg-[#fbfaf8] px-4 py-3 text-sm outline-none transition"
                style={{ borderColor: phoneError ? "#f87171" : "#e1d8ca" }}
              />
              {phoneError ? <p className="mt-2 text-xs text-red-600">{phoneError}</p> : null}

              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-[#8f836f]">Choose Data Package</p>
              {plansLoading ? (
                <div className="mt-3 rounded-xl border border-[#e5ddcf] bg-[#fbfaf8] px-4 py-4 text-sm text-[#746b5e]">
                  Loading packages...
                </div>
              ) : activePlans.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {activePlans.map((plan) => {
                    const selected = selectedPlan?.id === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlan(plan)}
                        className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-left"
                        style={{
                          borderColor: selected ? primaryColor : "#e5ddcf",
                          backgroundColor: selected ? primaryRgba(0.08) : "#ffffff"
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-[#1d180f]">{plan.dataAmount || plan.name}</span>
                          <span className="block truncate text-xs text-[#8f836f]">No Expiry</span>
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

            <div className="mt-4 space-y-2 rounded-xl border border-white/15 bg-white/5 p-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-white/90">
                <input
                  type="checkbox"
                  checked={useWalletBalance}
                  onChange={(event) => setUseWalletBalance(event.target.checked)}
                />
                Use Wallet
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-white/90">
                <input
                  type="checkbox"
                  checked={applyRewards}
                  disabled={!rewardEligible || !useWalletBalance}
                  onChange={(event) => setApplyRewards(event.target.checked)}
                />
                Use Rewards with wallet (min GHS 50)
              </label>
              <p className="text-[11px] text-white/70">
                Rewards: {formatCurrency(rewardsBalance.currentBalance, "GHS")} • Applied: {formatCurrency(rewardToApply, "GHS")}
              </p>
            </div>

            {error ? (
              <div className="mt-3 rounded-xl border border-red-400/50 bg-red-200/15 px-3 py-2 text-xs font-semibold text-red-200">
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
              {isPaying ? "Processing Payment..." : "Pay Securely Now"}
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
