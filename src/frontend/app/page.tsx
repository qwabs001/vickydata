"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NetworkSelector } from "@/frontend/components/landing/NetworkSelector";
import { DataPlanCards } from "@/frontend/components/landing/DataPlanCards";
import { PhoneNumberInput } from "@/frontend/components/landing/PhoneNumberInput";
import { MobileBottomNav } from "@/frontend/components/navigation/MobileBottomNav";
import { Dialog } from "@/frontend/components/ui/dialog";

const SignupModal = dynamic(
  () => import("@/frontend/components/landing/SignupModal").then((m) => ({ default: m.SignupModal })),
  { ssr: false }
);

const LoginModal = dynamic(
  () => import("@/frontend/components/landing/LoginModal").then((m) => ({ default: m.LoginModal })),
  { ssr: false }
);
import { useNetworks } from "@/frontend/hooks/useNetworks";
import { useDataPlans } from "@/frontend/hooks/useDataPlans";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useRewards } from "@/frontend/hooks/useRewards";
import { useWallet } from "@/frontend/hooks/useWallet";
import { useLandingConfig } from "@/frontend/providers/LandingConfigProvider";
import { useTheme } from "@/frontend/providers/ThemeProvider";
import { getDefaultRouteForRole } from "@/frontend/lib/authRoutes";
import type { DataPlan, Network } from "@/shared/types";
import { formatCurrency, formatGhanaPhone } from "@/shared/utils/formatters";
import { isValidGhanaPhone } from "@/shared/utils/validators";


const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ghbundle.com";

function HomePageContent() {
  const { networks } = useNetworks();
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const { plans } = useDataPlans(selectedNetwork?.id, selectedNetwork?.name);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [loginFromPayFlow, setLoginFromPayFlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [applyRewards, setApplyRewards] = useState(false);
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNotice, setWalletNotice] = useState<string | null>(null);

  const { isAuthenticated, login, logout, user } = useAuth();
  const { balance: rewardsBalance, refresh: refreshRewards } = useRewards();
  const {
    balance: walletBalance,
    addFunds,
    refresh: refreshWallet,
    loading: walletLoading
  } = useWallet();
  const { logoUrl, footer: footerSettings } = useTheme();
  const defaultBrandLogo = "/images/networks/ghbundlw.png?v=2";
  const brandLogo = logoUrl || defaultBrandLogo;
  const { config } = useLandingConfig();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isEmbedded = pathname?.startsWith("/dashboard/buy-data");
  const quickPlanId = useMemo(() => searchParams.get("planId"), [searchParams]);
  const quickNetworkId = useMemo(() => searchParams.get("networkId"), [searchParams]);
  const quickPhone = useMemo(() => searchParams.get("phone"), [searchParams]);
  const authAction = useMemo(() => {
    const raw = searchParams.get("auth") ?? searchParams.get("login");
    return raw?.toLowerCase() ?? null;
  }, [searchParams]);
  const buyNowUrl = config.popularBundles.buyNowUrl ?? "https://360promo.uk/#/dashboard";
  const rewardsRoute =
    user?.role === "ADMIN" ? "/admin/rewards" : user?.role === "AGENT" ? "/agent/rewards" : "/rewards";
  const homeRoute = getDefaultRouteForRole(user?.role);
  const referralCode = useMemo(() => {
    const ref = searchParams.get("ref") ?? searchParams.get("referral");
    return ref?.trim() || null;
  }, [searchParams]);

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  const displayPrice = useMemo(() => {
    if (!selectedPlan) return 0;
    return selectedPlan.price;
  }, [selectedPlan]);

  const rewardEligible = rewardsBalance.currentBalance >= 50;
  useEffect(() => {
    if (!rewardEligible) {
      setApplyRewards(false);
    }
  }, [rewardEligible]);
  const rewardToApply = useMemo(() => {
    if (!applyRewards || !rewardEligible) return 0;
    return Math.min(rewardsBalance.currentBalance, displayPrice);
  }, [applyRewards, rewardEligible, rewardsBalance.currentBalance, displayPrice]);

  const payableAmount = useMemo(() => {
    return Math.max(0, displayPrice - rewardToApply);
  }, [displayPrice, rewardToApply]);

  const amountLabel = useMemo(() => {
    if (!selectedPlan) return "PAY NOW";
    return "PAY NOW";
  }, [selectedPlan]);

  const planSummary = useMemo(() => {
    if (!selectedPlan || !selectedNetwork) {
      return "Select a plan to continue";
    }
    return `for ${selectedPlan.dataAmount} ${selectedNetwork.name} Plan`;
  }, [selectedPlan, selectedNetwork]);

  const rewardPoints = useMemo(() => {
    if (!selectedPlan) return 0;
    return Math.round(payableAmount * 0.01 * 100) / 100;
  }, [payableAmount, selectedPlan]);

  const phoneError =
    phoneNumber.trim().length > 0 && !isValidGhanaPhone(phoneNumber)
      ? "Enter a valid Ghana phone number"
      : null;

  const handleNetworkSelect = (network: Network) => {
    setSelectedNetwork(network);
    setSelectedPlan(null);
  };

  useEffect(() => {
    if (!quickNetworkId || selectedNetwork || networks.length === 0) return;
    const match = networks.find((network) => network.id === quickNetworkId);
    if (match) {
      setSelectedNetwork(match);
    }
  }, [quickNetworkId, networks, selectedNetwork]);

  // Hide mobile nav when modals (Signup, Login, Add Funds) are open
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (showSignup || showLogin || showWalletModal) {
      document.body.classList.add("hide-mobile-nav");
    } else {
      document.body.classList.remove("hide-mobile-nav");
    }
    return () => document.body.classList.remove("hide-mobile-nav");
  }, [showSignup, showLogin, showWalletModal]);

  useEffect(() => {
    if (!quickPlanId || !plans.length) return;
    if (selectedPlan?.id === quickPlanId) return;
    const match = plans.find((plan) => plan.id === quickPlanId);
    if (match) {
      setSelectedPlan(match);
    }
  }, [quickPlanId, plans, selectedPlan]);

  useEffect(() => {
    if (!quickPhone || phoneNumber) return;
    setPhoneNumber(formatGhanaPhone(quickPhone));
  }, [quickPhone, phoneNumber]);

  useEffect(() => {
    if (authAction !== "login") return;
    setShowLogin(true);
    setShowSignup(false);
    setShowRegister(false);
  }, [authAction]);

  const proceedToPayment = async (userId: string) => {
    if (!selectedNetwork || !selectedPlan || !isValidGhanaPhone(phoneNumber)) return;

    // Wallet-only payment: create order directly (no Moolre needed)
    if (useWalletBalance) {
      if (walletBalance.currentBalance < payableAmount) {
        setError("Insufficient wallet balance.");
        return;
      }
      try {
        const orderResponse = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
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
          return;
        }
        await refreshRewards();
        await refreshWallet();
        router.push("/orders");
      } catch {
        setError("Unable to create order.");
      }
      return;
    }

    // Moolre payment: initialize payment first, order created after payment succeeds
    const ref = `ORDER-${userId}-${Date.now()}`;
    try {
      const res = await fetch("/api/payments/moolre/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
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
      const data = await res.json().catch(() => null);
      if (data?.error) {
        setError(typeof data.error === "string" ? data.error : "Unable to open payment gateway.");
        return;
      }
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      setError("Unable to open payment page. Please try again.");
    } catch {
      setError("Unable to open payment gateway.");
    }
  };

  const handlePayNow = async () => {
    if (!selectedNetwork || !selectedPlan || !isValidGhanaPhone(phoneNumber)) {
      setError("Select a network, plan, and valid phone number to continue.");
      return;
    }
    setError(null);
    if (!isAuthenticated) {
      setLoginFromPayFlow(true);
      setShowSignup(true);
      return;
    }
    setIsPaying(true);
    if (!user?.id) {
      setError("Please login to continue.");
      setIsPaying(false);
      return;
    }
    await proceedToPayment(user.id);
    setIsPaying(false);
  };

  const handleGetStarted = () => {
    const target = document.getElementById("select-network");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleRewardClick = () => {
    if (isAuthenticated) return;
    setLoginFromPayFlow(false);
    setLoginError(null);
    setLoginNotice(null);
    setShowLogin(true);
  };

  const handleSignup = async (payload: {
    username: string;
    phoneNumber: string;
    password: string;
    confirmPassword: string;
  }) => {
    if (!selectedNetwork || !selectedPlan) {
      setError("Select a network and plan to continue.");
      return;
    }
    if (!isValidGhanaPhone(payload.phoneNumber)) {
      setError("Enter a valid Ghana phone number for your account.");
      return;
    }
    if (!isValidGhanaPhone(phoneNumber)) {
      setError("Enter a valid recipient phone number.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: payload.username,
          phoneNumber: payload.phoneNumber,
          password: payload.password,
          confirmPassword: payload.confirmPassword,
          ...(referralCode ? { referralCode } : {})
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Unable to create account.");
        return;
      }

      const newUser = await response.json();
      login(newUser);
      setShowSignup(false);
      setIsSubmitting(false);

      setIsPaying(true);
      await proceedToPayment(newUser.id);
    } catch {
      setError("Unable to create account.");
    } finally {
      setIsSubmitting(false);
      setIsPaying(false);
    }
  };

  const handleLogin = async (payload: { username: string; password: string }) => {
    setIsLoginSubmitting(true);
    setLoginError(null);
    setLoginNotice(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setLoginError(data?.error ?? "Unable to login. Please try again.");
        return;
      }

      const loggedInUser = await response.json();
      login(loggedInUser);
      setShowLogin(false);
      setLoginFromPayFlow(false);

      const shouldProceedToPayment =
        loginFromPayFlow &&
        selectedNetwork &&
        selectedPlan &&
        isValidGhanaPhone(phoneNumber);
      if (shouldProceedToPayment && loggedInUser.role !== "ADMIN") {
        setIsPaying(true);
        await proceedToPayment(loggedInUser.id);
      } else {
        router.push(getDefaultRouteForRole(loggedInUser.role));
      }
    } catch (err) {
      setLoginError("Unable to login. Please try again.");
    } finally {
      setIsLoginSubmitting(false);
      setIsPaying(false);
    }
  };

  const handleRegister = async (payload: {
    username: string;
    phoneNumber: string;
    password: string;
    confirmPassword: string;
  }) => {
    setIsRegisterSubmitting(true);
    setError(null);
    if (!isValidGhanaPhone(payload.phoneNumber)) {
      setError("Enter a valid Ghana phone number.");
      setIsRegisterSubmitting(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          ...(referralCode ? { referralCode } : {})
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Unable to create account.");
        return;
      }

      const user = await response.json();
      login(user);
      setShowRegister(false);
      router.push(getDefaultRouteForRole(user.role));
    } finally {
      setIsRegisterSubmitting(false);
    }
  };

  const handleResetPassword = async (payload: {
    username: string;
    phoneNumber: string;
    password: string;
    confirmPassword: string;
  }) => {
    setIsLoginSubmitting(true);
    setLoginError(null);
    setLoginNotice(null);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setLoginError(data?.error ?? "Unable to reset password.");
        return;
      }

      setLoginNotice("Password updated. Please login.");
    } catch (err) {
      setLoginError("Unable to reset password.");
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const containerPadding = isEmbedded
    ? "px-4 md:px-8 lg:px-10"
    : "px-6 md:px-20 lg:px-40";

  return (
    <div className={`group/design-root relative flex w-full flex-col overflow-x-hidden bg-background-light font-display text-[#0d131c] transition-colors duration-200 dark:bg-background-dark dark:text-white ${isEmbedded ? "pb-20 md:pb-0" : user ? "min-h-screen pb-24 md:pb-0" : "min-h-screen"}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: [
              {
                "@type": "SiteNavigationElement",
                position: 1,
                name: "View Offers",
                url: `${SITE_URL}/offers`
              },
              {
                "@type": "SiteNavigationElement",
                position: 2,
                name: "View Pricing",
                url: `${SITE_URL}/pricing`
              },
              {
                "@type": "SiteNavigationElement",
                position: 3,
                name: "Buy Now",
                url: `${SITE_URL}/buy-now`
              },
              {
                "@type": "SiteNavigationElement",
                position: 4,
                name: "Sign In",
                url: `${SITE_URL}/signin`
              }
            ]
          })
        }}
      />
      <div className="layout-container flex h-full grow flex-col">
        {!isEmbedded && (
        <header className={`sticky top-0 z-50 bg-background-light/80 py-4 backdrop-blur-md ${containerPadding}`}>
          <div className="flex items-center justify-between rounded-2xl border border-[#eef2f7] bg-white px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)] md:hidden">
            <a href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
                <Image src={brandLogo} alt="GhBundle logo" width={32} height={32} priority className="h-full w-full object-contain" />
              </div>
              <span className="text-base font-black tracking-tight text-[#0f172a]">GhBundle</span>
            </a>
            {!isAuthenticated ? (
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e7efff] text-[#94a3b8]"
                aria-label="Open account"
                onClick={() => {
                  setLoginFromPayFlow(false);
                  setLoginError(null);
                  setLoginNotice(null);
                  setShowLogin(true);
                }}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c1.8-3.5 6-5 8-5s6.2 1.5 8 5" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  onClick={() => setShowWalletModal(true)}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                    <path d="M16 7V5a2 2 0 0 0-2-2H5" />
                    <path d="M16 12h4" />
                  </svg>
                  {walletLoading ? "..." : formatCurrency(walletBalance.currentBalance, "GHS")}
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.2)]"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
          <div className="hidden items-center justify-between rounded-full border border-[#eef2f7] bg-white/90 px-6 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)] md:flex">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
                <Image src={brandLogo} alt="GhBundle logo" width={36} height={36} priority className="h-full w-full object-contain" />
              </div>
              <h2 className="text-lg font-black leading-tight tracking-tight text-[#0d131c]">
                GhBundle
              </h2>
            </div>
            <div className="flex items-center gap-8">
              <button
                type="button"
                className="hidden items-center gap-2 rounded-full border border-[var(--accent)]/50 bg-white px-5 py-2 text-sm font-semibold text-[#0f172a] transition-all hover:border-[var(--accent)] md:inline-flex"
                onClick={() => {
                  if (isAuthenticated) {
                    router.push(rewardsRoute);
                    return;
                  }
                  setLoginFromPayFlow(false);
                  setLoginError("Please login to access Rewards.");
                  setLoginNotice(null);
                  setShowLogin(true);
                }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 7h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                  <path d="M16 7V5a2 2 0 0 0-2-2H5" />
                  <path d="M16 12h4" />
                </svg>
                Rewards
              </button>
              {!isAuthenticated ? (
                <button
                  type="button"
                  className="flex h-10 min-w-[110px] items-center justify-center rounded-full bg-[#0f172a] px-6 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.2)] transition-all hover:bg-[#111827]"
                  onClick={() => {
                    setLoginError(null);
                    setLoginNotice(null);
                    setShowLogin(true);
                  }}
                >
                  Sign In
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    onClick={() => setShowWalletModal(true)}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 7h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                      <path d="M16 7V5a2 2 0 0 0-2-2H5" />
                      <path d="M16 12h4" />
                    </svg>
                    {walletLoading ? "Loading..." : formatCurrency(walletBalance.currentBalance, "GHS")}
                  </button>
                  <button
                    type="button"
                    className="flex h-10 min-w-[160px] items-center justify-center rounded-full bg-[#0f172a] px-6 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.2)] transition-all hover:bg-[#111827]"
                    onClick={() => router.push(homeRoute)}
                  >
                    Back to Dashboard
                  </button>
                  <button
                    type="button"
                    className="flex h-10 min-w-[110px] items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        )}

        <main className={`flex-1 py-8 md:py-10 ${containerPadding}`}>
          <div
            id="buy-now"
            className={`mx-auto flex w-full flex-col gap-8 md:gap-12 ${
              isEmbedded ? "max-w-[960px]" : "max-w-[1100px]"
            }`}
          >
            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:hidden">
              <h1 className="text-lg font-bold text-[#0f172a]">
                Welcome to GhBundle
              </h1>
              <p className="text-sm text-slate-500">Buy Data Bundles Instantly</p>
            </section>

            <section className="hidden flex-col gap-10 py-10 md:flex lg:flex-row lg:items-center lg:justify-between">
              <div className="flex max-w-xl flex-col gap-6">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[rgb(var(--accent-rgb)/0.15)] px-4 py-1 text-xs font-bold uppercase tracking-wider text-[#0f172a]">
                  <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                  <span
                    className="typing-loop"
                    style={
                      {
                        "--typing-width": "32ch",
                        "--typing-steps": 32
                      } as React.CSSProperties
                    }
                  >
                    Delivery Takes 20mins - 1hour
                  </span>
                </div>
                <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-[#0f172a] md:text-6xl">
                  Get More <span className="text-[var(--accent)]">Data</span>
                  <br />
                  For Less.
                </h1>
                <p className="text-base font-medium text-slate-600">
                  Instantly top up your data across all major networks in Ghana. Enjoy
                  massive discounts and earn rewards with every purchase.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    className="flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-[#0f172a] outline outline-1 outline-slate-300 outline-offset-2 transition-all hover:translate-y-[-1px]"
                    onClick={handleGetStarted}
                    type="button"
                  >
                    Get Started
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14" />
                      <path d="M13 6l6 6-6 6" />
                  </svg>
                  </button>
                  <button
                    className="flex h-12 items-center gap-2 rounded-full border border-[var(--accent)]/50 bg-white px-6 text-sm font-semibold text-[#0f172a] transition-all hover:border-[var(--accent)]"
                    type="button"
                    onClick={() => {
                      if (isAuthenticated) {
                        router.push(rewardsRoute);
                        return;
                      }
                      setLoginError("Please login to access Rewards.");
                      setLoginNotice(null);
                      setShowLogin(true);
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 7h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                      <path d="M16 7V5a2 2 0 0 0-2-2H5" />
                      <path d="M16 12h4" />
                    </svg>
                    Rewards
                  </button>
                </div>
              </div>
              <div className="relative h-[340px] w-full max-w-[440px]">
                <div className="absolute right-16 top-0 z-0 h-[230px] w-[210px] rounded-[32px] bg-white shadow-[0_22px_45px_rgba(15,23,42,0.12)] animate-float-slow">
                  <div className="flex h-full flex-col p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-[0_10px_20px_rgba(15,23,42,0.08)]">
                        <div
                          className="h-6 w-6 bg-contain bg-center bg-no-repeat"
                          style={{ backgroundImage: "url('/images/networks/Screenshot%202026-02-06%20at%202.19.42%20AM.png')" }}
                        />
                      </div>
                      <div className="h-8 w-8 rounded-full bg-[#dbe4f1]" />
                    </div>
                    <div className="mt-5 space-y-3">
                      <div className="h-2 w-24 rounded-full bg-slate-100" />
                      <div className="h-2 w-16 rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
                <div className="absolute right-32 top-24 z-0 h-[210px] w-[190px] rounded-[28px] bg-white shadow-[0_18px_36px_rgba(15,23,42,0.12)] animate-float-slow">
                  <div className="flex h-full flex-col p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-[0_10px_20px_rgba(15,23,42,0.08)]">
                        <div
                          className="h-6 w-6 bg-contain bg-center bg-no-repeat"
                          style={{ backgroundImage: "url('/images/networks/TG-LOGOO-03_400.png.webp')" }}
                        />
                      </div>
                      <div className="h-8 w-8 rounded-full bg-[#f1e0e3]" />
                    </div>
                    <div className="mt-5 space-y-3">
                      <div className="h-2 w-24 rounded-full bg-slate-100" />
                      <div className="h-2 w-16 rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
                <div className="absolute right-0 top-10 z-10 h-[270px] w-[245px] rounded-[32px] bg-gradient-to-br from-white via-white to-[rgb(var(--accent-rgb)/0.18)] p-6 shadow-[0_30px_60px_rgba(15,23,42,0.18)] animate-float">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-[0_10px_20px_rgba(15,23,42,0.08)]">
                      <div
                        className="h-6 w-6 bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: "url('/images/networks/airteltigo-424x424-1.png')" }}
                      />
                    </div>
                    <div className="h-9 w-9 rounded-full bg-[#f6cfd3] blur-[1px]" />
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="h-2 w-28 rounded-full bg-slate-100" />
                    <div className="h-2 w-20 rounded-full bg-slate-100" />
                  </div>
                  <div className="mt-8">
                    <p className="text-2xl font-black text-[#0f172a]">20 GB</p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Premium Pass
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4 md:gap-6" id="select-network">
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[#0f172a] md:size-10 md:text-base">
                  1
                </span>
                <h2 className="text-base font-bold text-[#0d131c] dark:text-white md:text-2xl">
                  <span className="md:hidden">Select Network</span>
                  <span className="hidden md:inline">Select Your Network</span>
                </h2>
              </div>
              <NetworkSelector
                networks={networks}
                selectedId={selectedNetwork?.id}
                onSelect={handleNetworkSelect}
              />
            </section>

            <section className="flex flex-col gap-4 md:gap-6">
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[#0f172a] md:size-10 md:text-base">
                  2
                </span>
                <h2 className="text-base font-bold text-[#0d131c] dark:text-white md:text-2xl">
                  <span className="md:hidden">Recipient Number</span>
                  <span className="hidden md:inline">Recipient Details</span>
                </h2>
              </div>
              <div className="max-w-md rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:p-8">
                <PhoneNumberInput
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  error={phoneError}
                />
              </div>
            </section>

            <section className="flex flex-col gap-4 md:gap-6">
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[#0f172a] md:size-10 md:text-base">
                  3
                </span>
                <h2 className="text-base font-bold text-[#0d131c] dark:text-white md:text-2xl">
                  <span className="md:hidden">Select Data Plan</span>
                  <span className="hidden md:inline">Choose a Data Plan</span>
                </h2>
              </div>
              {selectedNetwork ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#e7efff] px-3 py-1 text-xs font-semibold text-[#2563eb]">
                    {selectedNetwork.name} Plans
                  </span>
                </div>
              ) : null}
              <DataPlanCards
                plans={plans}
                selectedId={selectedPlan?.id}
                onSelect={setSelectedPlan}
              />
            </section>

            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <section className="mt-4">
              <div className="md:hidden space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
                    Order Summary
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Network</span>
                      <span className="flex items-center gap-2 font-semibold text-slate-800">
                        {selectedNetwork?.displayName ?? selectedNetwork?.name ?? "Select network"}
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Data Plan</span>
                      <span className="font-semibold text-slate-800">
                        {selectedPlan ? `${selectedPlan.dataAmount} • No Expiry` : "Select a plan"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Recipient</span>
                      <span className="font-semibold text-slate-800">
                        {phoneNumber || "Enter phone"}
                      </span>
                    </div>
                  </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm font-semibold text-slate-800">Total Amount</span>
                  <span className="text-lg font-bold text-[var(--accent)]">
                    {formatCurrency(payableAmount, selectedPlan?.currency ?? "GHS")}
                  </span>
                </div>
                {isAuthenticated ? (
                  <div className="mt-4 space-y-3 text-xs text-slate-600">
                    <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <span className="font-semibold">Use Wallet Balance</span>
                      <input
                        type="checkbox"
                        checked={useWalletBalance}
                        onChange={(event) => setUseWalletBalance(event.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <span className="font-semibold">Use Rewards (min GHS 50)</span>
                      <input
                        type="checkbox"
                        checked={applyRewards}
                        disabled={!rewardEligible}
                        onChange={(event) => setApplyRewards(event.target.checked)}
                      />
                    </label>
                    <p className="text-xs text-slate-400">
                      Wallet: {formatCurrency(walletBalance.currentBalance, "GHS")} • Rewards: {formatCurrency(rewardsBalance.currentBalance, "GHS")}
                    </p>
                  </div>
                ) : null}
              </div>
                <button
                  className={`flex h-12 w-full items-center justify-center gap-3 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white transition-all ${
                    isPaying ? "cursor-wait opacity-75" : "active:scale-[0.99]"
                  }`}
                  onClick={handlePayNow}
                  disabled={isPaying}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 7h14a3 3 0 013 3v5a3 3 0 01-3 3H5a2 2 0 01-2-2V7z" />
                      <path d="M18 7V5a2 2 0 00-2-2H6" />
                      <path d="M16 12h4" />
                    </svg>
                  </span>
                  <span>
                    {isPaying
                      ? "Processing..."
                      : `PAY ${formatCurrency(payableAmount, selectedPlan?.currency ?? "GHS")}`}
                  </span>
                </button>
                <p className="text-center text-[11px] text-slate-400">
                  By tapping Pay, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>

              <div className="hidden flex-col justify-between gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-gray-800 md:flex md:flex-row md:items-center">
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-400">
                    Order Summary
                  </h3>
                  <div className="flex items-baseline gap-4">
                    <span className="text-3xl font-black text-[#0d131c] dark:text-white">
                      {formatCurrency(payableAmount, selectedPlan?.currency ?? "GHS")}
                    </span>
                    <span className="text-lg text-gray-400">{planSummary}</span>
                  </div>
                  <button
                    className="flex items-center gap-2 text-[var(--accent)] text-sm font-bold"
                    type="button"
                    onClick={handleRewardClick}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                      <path d="M12 3l1.8 3.7 4.1.6-3 2.9.7 4.1L12 12.9 8.4 14.3l.7-4.1-3-2.9 4.1-.6L12 3z" />
                    </svg>
                    <span>You'll earn {rewardPoints} GH Points</span>
                  </button>
                  {isAuthenticated ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
                        <input
                          type="checkbox"
                          checked={useWalletBalance}
                          onChange={(event) => setUseWalletBalance(event.target.checked)}
                        />
                        Use Wallet
                      </label>
                      <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
                        <input
                          type="checkbox"
                          checked={applyRewards}
                          disabled={!rewardEligible}
                          onChange={(event) => setApplyRewards(event.target.checked)}
                        />
                        Use Rewards (min GHS 50)
                      </label>
                      <span>Wallet: {formatCurrency(walletBalance.currentBalance, "GHS")}</span>
                      <span>Rewards: {formatCurrency(rewardsBalance.currentBalance, "GHS")}</span>
                    </div>
                  ) : null}
                </div>
                <button
                  className={`flex h-12 flex-1 items-center justify-center gap-3 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white transition-all md:h-14 md:min-w-[280px] md:flex-none ${
                    isPaying ? "cursor-wait opacity-75" : "hover:scale-[1.01] active:scale-[0.99]"
                  }`}
                  onClick={handlePayNow}
                  disabled={isPaying}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 7h14a3 3 0 013 3v5a3 3 0 01-3 3H5a2 2 0 01-2-2V7z" />
                      <path d="M18 7V5a2 2 0 00-2-2H6" />
                      <path d="M16 12h4" />
                    </svg>
                  </span>
                  <span>
                    {isPaying
                      ? "Processing..."
                      : `PAY ${formatCurrency(payableAmount, selectedPlan?.currency ?? "GHS")}`}
                  </span>
                </button>
              </div>
            </section>

            {config.popularBundles.enabled ? (
              <section id="offers" className="mt-12 rounded-[32px] bg-[#f6f8fb] px-6 py-12 shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
                <div className="mx-auto max-w-[1100px]">
                  <div id="pricing" />
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div>
                      <h2 className="text-2xl font-bold text-[#0f172a]">
                        {config.popularBundles.title}
                      </h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        {config.popularBundles.subtitle}
                      </p>
                    </div>
                    <a
                      className="flex items-center gap-2 rounded-full border border-[var(--accent)] bg-white px-4 py-2 text-xs font-semibold text-[var(--accent)]"
                      href={config.popularBundles.ctaUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {config.popularBundles.ctaText}
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14" />
                        <path d="M13 6l6 6-6 6" />
                      </svg>
                    </a>
                  </div>

                  <div
                    className={
                      isEmbedded
                        ? "mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
                        : "mt-10 flex gap-6 overflow-x-auto pb-2 pr-2 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible md:snap-none"
                    }
                  >
                    {config.popularBundles.items.map((bundle) => {
                      const icon = (() => {
                        switch (bundle.id) {
                          case "tiktok-services":
                            return (
                              <Image
                                src="/images/networks/Tiktok_icon.svg.png"
                                alt="TikTok"
                                width={36}
                                height={36}
                                className="h-auto w-auto"
                              />
                            );
                          case "instagram-service":
                            return (
                              <Image
                                src="/images/networks/Instagram_icon.png.webp"
                                alt="Instagram"
                                width={36}
                                height={36}
                                className="h-auto w-auto"
                              />
                            );
                          case "youtube-service":
                            return (
                              <Image
                                src="/images/networks/youtube-logo.png"
                                alt="YouTube"
                                width={40}
                                height={28}
                                className="h-auto w-auto"
                              />
                            );
                          case "facebook-services":
                          default:
                            return (
                              <Image
                                src="/images/networks/Facebook_Logo_(2019).png"
                                alt="Facebook"
                                width={36}
                                height={36}
                                className="h-auto w-auto"
                              />
                            );
                        }
                      })();

                      return (
                        <div
                          key={bundle.id}
                          className={`relative flex h-full ${
                            isEmbedded ? "" : "min-w-[240px] snap-start md:min-w-0"
                          } flex-col rounded-3xl bg-white p-6 shadow-[0_20px_40px_rgba(15,23,42,0.06)] ${
                            bundle.isFeatured ? "border border-[var(--accent)]" : "border border-transparent"
                          }`}
                        >
                          {bundle.isFeatured ? (
                            <span className="absolute left-1/2 top-[-14px] -translate-x-1/2 rounded-full bg-[var(--accent)] px-4 py-1 text-xs font-semibold text-[#0f172a]">
                              Best Value
                            </span>
                          ) : null}
                          <div className="flex flex-col items-center gap-4 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                              {icon}
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                              {bundle.title}
                            </p>
                          </div>
                          <p className="mt-4 text-lg font-bold text-[var(--accent)]">
                            {bundle.priceRange}
                          </p>
                          <ul className="mt-4 space-y-2 text-sm text-slate-600">
                            {bundle.features.map((feature) => (
                              <li key={feature} className="flex items-center gap-2">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M5 12l4 4L19 7" />
                                  </svg>
                                </span>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                          <a
                            className={`mt-6 flex h-10 w-full items-center justify-center rounded-full text-sm font-semibold ${
                              bundle.isFeatured
                                ? "bg-[var(--accent)] text-[#0f172a] shadow-[0_12px_24px_rgba(var(--accent-rgb)/0.35)]"
                                : "bg-slate-100 text-slate-700"
                            }`}
                            href={buyNowUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {bundle.ctaLabel}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </main>

        {!isEmbedded && (
        <footer className="mt-16 border-t border-[#eef2f7] bg-[#f3f6fb] px-6 py-8 md:px-20 lg:px-40">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-6 md:flex-row">
            {(footerSettings?.showLogo !== false) && (
              <div className="flex w-full items-center justify-center gap-3 md:w-auto md:justify-start">
                <Image src={brandLogo} alt="Logo" width={32} height={32} priority className="h-8 w-8 rounded-xl object-contain" />
                <span className="text-sm font-semibold text-[#0f172a]">GhBundle</span>
              </div>
            )}
            <p className="text-xs text-slate-500 md:text-left text-center w-full md:w-auto">
              {footerSettings?.copyright || `© ${new Date().getFullYear()} GhBundle. All rights reserved.`}
            </p>
            <div className="flex w-full items-center justify-center gap-6 text-xs text-slate-500 md:w-auto md:justify-end">
              <a className="hover:text-slate-700" href={footerSettings?.privacyUrl || "#"} target={footerSettings?.privacyUrl ? "_blank" : undefined} rel={footerSettings?.privacyUrl ? "noopener noreferrer" : undefined}>
                Privacy
              </a>
              <a className="hover:text-slate-700" href={footerSettings?.termsUrl || "#"} target={footerSettings?.termsUrl ? "_blank" : undefined} rel={footerSettings?.termsUrl ? "noopener noreferrer" : undefined}>
                Terms
              </a>
              <a className="hover:text-slate-700" href={footerSettings?.contactUrl || "#"} target={footerSettings?.contactUrl ? "_blank" : undefined} rel={footerSettings?.contactUrl ? "noopener noreferrer" : undefined}>
                Contact
              </a>
            </div>
          </div>
        </footer>
        )}
      </div>

      <SignupModal
        open={showSignup}
        onClose={() => setShowSignup(false)}
        onLoginClick={() => {
          setShowSignup(false);
          setLoginError(null);
          setLoginNotice(null);
          setShowLogin(true);
        }}
        phoneNumber={phoneNumber}
        mobileSheet
        onSubmit={handleSignup}
        isSubmitting={isSubmitting}
      />
      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onSubmit={handleLogin}
        onResetPassword={handleResetPassword}
        onRegisterClick={() => {
          setShowLogin(false);
          setShowRegister(true);
        }}
        mobileSheet
        isSubmitting={isLoginSubmitting}
        error={loginError}
        notice={loginNotice}
      />
      <SignupModal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        phoneNumber=""
        editablePhoneNumber
        mobileSheet
        title="Create your GhBundle account"
        subtitle="Register to access your dashboard and manage orders."
        submitLabel="Create Account"
        onSubmit={handleRegister}
        isSubmitting={isRegisterSubmitting}
        error={error}
      />
      <Dialog open={showWalletModal} onClose={() => setShowWalletModal(false)} mobileBottomSheet>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Wallet Balance</h3>
              <p className="mt-1 text-sm text-slate-500">
                Add funds to your wallet and pay instantly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWalletModal(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {walletNotice ? (
            <p className={`mt-3 rounded-xl px-4 py-3 text-sm ${
              walletNotice.startsWith("Enter") || walletNotice.startsWith("Unable")
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}>
              {walletNotice}
            </p>
          ) : null}
          <div className="mt-5 space-y-3">
            <label className="text-sm font-semibold text-slate-700">Amount to add (GHS)</label>
            <input
              value={walletAmount}
              onChange={(event) => setWalletAmount(event.target.value)}
              placeholder="50"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            You will be redirected to Moolre to complete the payment.
          </p>
          <button
            type="button"
            className="mt-6 w-full rounded-xl bg-[#0f172a] px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
            onClick={async () => {
              const amount = Number(walletAmount);
              if (!Number.isFinite(amount) || amount <= 0 || !user?.id) {
                setWalletNotice("Enter a valid amount.");
                return;
              }
              try {
                const ref = `WALLET-${user.id}-${Date.now()}`;
                const res = await fetch("/api/payments/moolre/initialize", {
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
                  setWalletNotice(typeof data.error === "string" ? data.error : "Unable to open payment gateway.");
                  return;
                }
                if (data?.paymentUrl) {
                  window.location.href = data.paymentUrl;
                  return;
                }
                setWalletNotice("Unable to open payment page. Please try again.");
              } catch {
                setWalletNotice("Unable to open payment gateway.");
              }
            }}
          >
            Add Funds
          </button>
        </div>
      </Dialog>

      {user ? (
        <MobileBottomNav homeHref="/" />
      ) : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
