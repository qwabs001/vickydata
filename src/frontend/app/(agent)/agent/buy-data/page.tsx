"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DataPlanCards } from "@/frontend/components/landing/DataPlanCards";
import { NetworkSelector } from "@/frontend/components/landing/NetworkSelector";
import { PhoneNumberInput } from "@/frontend/components/landing/PhoneNumberInput";
import { Dialog } from "@/frontend/components/ui/dialog";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useNetworks } from "@/frontend/hooks/useNetworks";
import { useRewards } from "@/frontend/hooks/useRewards";
import { useWallet } from "@/frontend/hooks/useWallet";
import type { DataPlan, Network } from "@/shared/types";
import { formatCurrency, formatGhanaPhone } from "@/shared/utils/formatters";
import { isValidGhanaPhone } from "@/shared/utils/validators";

export default function AgentBuyDataPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { networks } = useNetworks();
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
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

  useEffect(() => {
    if (!selectedNetwork?.id) {
      setPlans([]);
      return;
    }

    let active = true;
    setPlansLoading(true);
    const params = new URLSearchParams({ networkId: selectedNetwork.id });
    if (user?.id) params.set("userId", user.id);

    fetch(`/api/data-plans/by-network?${params.toString()}`)
      .then((response) => response.json().catch(() => []))
      .then((data) => {
        if (!active) return;
        setPlans(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setPlans([]);
      })
      .finally(() => {
        if (!active) return;
        setPlansLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedNetwork?.id, user?.id]);

  useEffect(() => {
    if (!rewardEligible) setApplyRewards(false);
  }, [rewardEligible]);

  useEffect(() => {
    if (!quickNetworkId || selectedNetwork || networks.length === 0) return;
    const match = networks.find((network) => network.id === quickNetworkId);
    if (match) setSelectedNetwork(match);
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
            recipientNumber: phoneNumber,
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
        router.push("/agent/orders");
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
          recipientNumber: phoneNumber,
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
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 pt-2 md:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Link
            href="/agent"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600"
            aria-label="Back to dashboard"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-base font-bold text-slate-900 md:text-xl">Buy Data (Agent)</h1>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 md:text-sm"
          onClick={() => setShowWalletModal(true)}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            <path d="M16 7V5a2 2 0 0 0-2-2H5" />
            <path d="M16 12h4" />
          </svg>
          {walletLoading ? "Loading..." : formatCurrency(walletBalance.currentBalance, "GHS")}
        </button>
      </div>

      <section className="flex flex-col gap-4 md:gap-6">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[#0f172a] md:size-10 md:text-base">
            1
          </span>
          <h2 className="text-base font-bold text-slate-900 md:text-xl">Select Network</h2>
        </div>
        <NetworkSelector
          networks={networks}
          selectedId={selectedNetwork?.id}
          onSelect={(network) => {
            setSelectedNetwork(network);
            setSelectedPlan(null);
          }}
        />
      </section>

      <section className="flex flex-col gap-4 md:gap-6">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[#0f172a] md:size-10 md:text-base">
            2
          </span>
          <h2 className="text-base font-bold text-slate-900 md:text-xl">Choose Plan</h2>
        </div>
        {plansLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">Loading plans...</div>
        ) : (
          <DataPlanCards plans={plans} selectedId={selectedPlan?.id} onSelect={setSelectedPlan} />
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[#0f172a] md:size-10 md:text-base">
              3
            </span>
            <h2 className="text-base font-bold text-slate-900 md:text-xl">Recipient</h2>
          </div>
          <div className="mt-4">
            <PhoneNumberInput value={phoneNumber} onChange={setPhoneNumber} error={phoneError} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Order Summary</p>
          <p className="mt-2 text-lg font-black text-slate-900">{formatCurrency(payableAmount, selectedPlan?.currency ?? "GHS")}</p>
          <p className="mt-1 text-xs text-slate-500">
            {selectedPlan ? `${selectedPlan.dataAmount} • ${selectedNetwork?.name ?? ""}` : "Select a plan"}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={useWalletBalance} onChange={(event) => setUseWalletBalance(event.target.checked)} />
              Use Wallet
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={applyRewards}
                disabled={!rewardEligible}
                onChange={(event) => setApplyRewards(event.target.checked)}
              />
              Use Rewards (min GHS 50)
            </label>
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            Rewards: {formatCurrency(rewardsBalance.currentBalance, "GHS")} • Applied: {formatCurrency(rewardToApply, "GHS")}
          </p>

          {error ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          ) : null}

          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-70"
            onClick={handlePayNow}
            disabled={isPaying}
          >
            {isPaying ? "Processing..." : `Pay ${formatCurrency(payableAmount, selectedPlan?.currency ?? "GHS")}`}
          </button>
        </div>
      </section>

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
