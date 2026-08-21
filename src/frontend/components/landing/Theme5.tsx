"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bolt,
  ChevronRight,
  Clock3,
  Headphones,
  Loader2,
  Lock,
  Menu,
  Signal,
  X,
} from "lucide-react";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useNetworks } from "@/frontend/hooks/useNetworks";
import { useAllDataPlans, useDataPlans } from "@/frontend/hooks/useDataPlans";
import { useWallet } from "@/frontend/hooks/useWallet";
import { useTheme } from "@/frontend/providers/ThemeProvider";
import { formatCurrency, formatGhanaPhone } from "@/shared/utils/formatters";
import { isValidGhanaPhone } from "@/shared/utils/validators";
import { getDefaultRouteForRole } from "@/frontend/lib/authRoutes";
import { LoginModal } from "@/frontend/components/landing/LoginModal";
import { SignupModal } from "@/frontend/components/landing/SignupModal";
import type { DataPlan, Network } from "@/shared/types";
import Image from "next/image";

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
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parsePlanSizeInGb(plan: DataPlan): number | null {
  const source = plan.dataAmount || plan.name || "";
  const match = source.trim().match(/^(\d+(?:\.\d+)?)\s*gb$/i);
  if (!match) return null;
  return Number(match[1]);
}

const Theme5: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, login } = useAuth();
  const { networks } = useNetworks();
  const { logoUrl, footer: footerSettings, accent, primary } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [selectedNetworkKey, setSelectedNetworkKey] = useState<DataBundleNetworkKey | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [recipientNumber, setRecipientNumber] = useState("");
  const [checkoutState, setCheckoutState] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const selectedNetwork = useMemo(() => {
    if (!selectedNetworkKey) return null;
    return networks.find((network) => {
      const normalized = normalizeName(network.name);
      const card = NETWORK_CARD_CONFIG.find((c) => c.key === selectedNetworkKey);
      return card?.matchers.some((matcher) => normalized.includes(matcher));
    }) || null;
  }, [networks, selectedNetworkKey]);

  const { plans: allPlans } = useAllDataPlans();
  const { plans } = useDataPlans(selectedNetwork?.id, selectedNetwork?.name);
  const { balance: walletBalance, refresh: refreshWallet, loading: walletLoading } = useWallet();

  const primaryColor = accent || primary || "#f5c63d";
  const sectionAccent = primary || "#4f6df5";
  const deepSurfaceColor = "#0F172B";
  const brandName = "VickyData";

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
  const sectionAccentRgb = useMemo(() => {
    const fallback = { r: 79, g: 109, b: 245 };
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(sectionAccent || "");
    if (!match) return fallback;
    return {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16),
    };
  }, [sectionAccent]);
  const sectionAccentRgba = (alpha: number) =>
    `rgba(${sectionAccentRgb.r}, ${sectionAccentRgb.g}, ${sectionAccentRgb.b}, ${alpha})`;

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
    const authParam = searchParams?.get("auth") || searchParams?.get("login");
    if (authParam === "login" && !isAuthenticated) {
      setShowLogin(true);
      setLoginError(null);
      setLoginNotice(null);
    }
  }, [searchParams, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUseWalletBalance(false);
    }
  }, [isAuthenticated]);

  const networkCards = useMemo(() => {
    return NETWORK_CARD_CONFIG.map((card) => {
      const matchedNetwork = networks.find((network) => {
        const normalized = normalizeName(network.name);
        return card.matchers.some((matcher) => normalized.includes(matcher));
      });

      const networkPlans = allPlans.filter((plan) => {
        if (!matchedNetwork) return false;
        return plan.networkId === matchedNetwork.id && plan.isActive;
      });

      return {
        ...card,
        networkId: matchedNetwork?.id || null,
        networkName: matchedNetwork?.name || card.label,
        packageCount: networkPlans.length,
      };
    });
  }, [allPlans, networks]);

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

  const initialVisiblePlans = useMemo(() => {
    const limitedPlans = filteredPlans.filter((plan) => {
      const sizeInGb = parsePlanSizeInGb(plan);
      return sizeInGb !== null && sizeInGb >= 1 && sizeInGb <= 5;
    });
    return limitedPlans.length > 0 ? limitedPlans : filteredPlans.slice(0, 5);
  }, [filteredPlans]);

  const visiblePlans = showAllPlans ? filteredPlans : initialVisiblePlans;
  const hasMorePlans = filteredPlans.length > initialVisiblePlans.length;

  useEffect(() => {
    if (filteredPlans.length === 0) {
      setSelectedPlan(null);
      return;
    }
    setSelectedPlan((current) => {
      if (current && filteredPlans.some((plan) => plan.id === current.id)) return current;
      return initialVisiblePlans[0] || filteredPlans[0];
    });
  }, [filteredPlans, initialVisiblePlans]);

  useEffect(() => {
    setShowAllPlans(false);
  }, [selectedNetworkCard?.networkId]);

  const selectedNetworkName = selectedNetworkCard?.networkName || "Select network";
  const selectedBundleName = selectedPlan?.name || "Select package";
  const totalCharge = selectedPlan?.price || 0;
  const walletCanCover = totalCharge > 0 && walletBalance.currentBalance >= totalCharge;
  const walletPayDisabled = useWalletBalance && isAuthenticated && (walletLoading || !walletCanCover);
  const payActionDisabled = !selectedPlan || isSubmitting || walletPayDisabled;

  const payButtonLabel = isSubmitting
    ? useWalletBalance
      ? "Processing Wallet Order..."
      : "Processing Payment..."
    : !isAuthenticated
      ? "Login to Pay"
      : useWalletBalance
        ? "Pay from Wallet"
        : "Pay Securely Now";

  const ordersRouteForRole =
    user?.role === "AGENT" ? "/agent/orders" : user?.role === "ADMIN" ? "/admin/orders" : "/orders";

  const handleStartNow = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowSignup(true);
    setSignupError(null);
  };

  const handleNavigation = (e: React.MouseEvent<HTMLButtonElement>, url: string) => {
    e.preventDefault();
    router.push(url);
  };

  const handleLogin = async (payload: { username: string; password: string }) => {
    setIsLoginSubmitting(true);
    setLoginError(null);
    setLoginNotice(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setLoginError(data?.error ?? "Unable to login. Please try again.");
        return;
      }

      const loggedInUser = await response.json();
      login(loggedInUser);
      setShowLogin(false);
      router.push(getDefaultRouteForRole(loggedInUser.role));
    } catch (err) {
      setLoginError("Unable to login. Please try again.");
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const handleSignup = async (payload: {
    username: string;
    phoneNumber: string;
    password: string;
    confirmPassword: string;
  }) => {
    if (!isValidGhanaPhone(payload.phoneNumber)) {
      setSignupError("Enter a valid Ghana phone number.");
      return;
    }

    setIsSignupSubmitting(true);
    setSignupError(null);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setSignupError(data?.error ?? "Unable to create account.");
        return;
      }

      const newUser = await response.json();
      login(newUser);
      setShowSignup(false);
      router.push(getDefaultRouteForRole(newUser.role));
    } catch {
      setSignupError("Unable to create account.");
    } finally {
      setIsSignupSubmitting(false);
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
        body: JSON.stringify(payload),
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

  const handleSecurePay = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!isAuthenticated || !user?.id) {
      setCheckoutState("error");
      setCheckoutMessage("Please login first to complete payment and create order.");
      setShowLogin(true);
      setLoginError(null);
      setLoginNotice(null);
      return;
    }

    if (!selectedPlan || !selectedNetwork) {
      setCheckoutState("error");
      setCheckoutMessage("Select a data package first.");
      return;
    }

    const cleanRecipient = digitsOnly(recipientNumber);
    if (!isValidGhanaPhone(cleanRecipient)) {
      setCheckoutState("error");
      setCheckoutMessage("Enter a valid recipient number before payment.");
      return;
    }

    setIsSubmitting(true);
    setCheckoutState("processing");
    setCheckoutMessage(useWalletBalance ? "Processing wallet payment..." : "Initializing payment...");

    try {
      if (useWalletBalance) {
        if (walletBalance.currentBalance < totalCharge) {
          setCheckoutState("error");
          setCheckoutMessage("Insufficient wallet balance.");
          return;
        }

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
            recipientNumber: cleanRecipient,
            rewardToUse: 0,
            useWallet: true,
          }),
        });

        const orderData = await orderResponse.json().catch(() => null);
        if (!orderResponse.ok) {
          setCheckoutState("error");
          setCheckoutMessage(orderData?.error ?? "Unable to create order.");
          return;
        }

        await refreshWallet();
        setCheckoutState("success");
        setCheckoutMessage("Wallet payment successful. Redirecting to your orders...");
        await sleep(900);
        router.push(ordersRouteForRole);
        return;
      }

      const ref = `ORDER-${user.id}-${Date.now()}`;
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount: totalCharge,
          currency: selectedPlan.currency ?? "GHS",
          ref,
          type: "order",
          networkId: selectedNetwork.id,
          dataPlanId: selectedPlan.id,
          recipientNumber: cleanRecipient,
          rewardToUse: 0,
          useWallet: false,
        }),
      });

      const data = await response.json().catch(() => null);
      if (data?.error) {
        setCheckoutState("error");
        setCheckoutMessage(typeof data.error === "string" ? data.error : "Could not initialize payment.");
        return;
      }

      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      setCheckoutState("error");
      setCheckoutMessage("Unable to open payment page. Please try again.");
    } catch (error: any) {
      setCheckoutState("error");
      setCheckoutMessage(error?.message || "Payment failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToNetworkSection = () => {
    const networkSection = document.getElementById("network-section");
    if (!networkSection) return;
    networkSection.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#f7f9fc] text-[#10213c]"
      style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}
    >
      <style>{`
        .theme5-hero {
          background:
            radial-gradient(circle at 7% 8%, ${primaryRgba(0.18)} 0, transparent 26rem),
            radial-gradient(circle at 92% 12%, rgba(79, 109, 245, 0.15) 0, transparent 25rem),
            linear-gradient(135deg, #ffffff 0%, #f4f7ff 52%, #effaf8 100%);
          box-shadow: 0 26px 70px rgba(23, 49, 92, 0.10);
        }
      `}</style>

      <header className="sticky top-0 z-40 border-b border-[#e7edf6] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] w-full max-w-[1180px] items-center justify-between px-4 md:px-6">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#10213c] shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {logoUrl && !logoFailed ? (
                <Image
                  src={logoUrl}
                  alt={brandName}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <Bolt size={15} className="fill-current" />
              )}
            </span>
            <span className="text-base font-extrabold tracking-tight text-[#10213c]">{brandName}</span>
          </button>

          <nav className="hidden items-center gap-7 text-sm font-bold text-[#60708a] md:flex">
            <button
              type="button"
              className="transition-colors hover:text-[#10213c]"
              onClick={() => scrollToNetworkSection()}
            >
              Data bundles
            </button>
            <button type="button" className="transition-colors hover:text-[#10213c]" onClick={scrollToNetworkSection}>
              How it works
            </button>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (isAuthenticated) {
                  router.push(getDefaultRouteForRole(user?.role));
                } else {
                  setShowLogin(true);
                  setLoginError(null);
                  setLoginNotice(null);
                }
              }}
              className="rounded-full px-4 py-2 text-sm font-bold text-[#31435f] transition-colors hover:bg-[#eff4fb]"
            >
              {isAuthenticated ? "Dashboard" : "Login"}
            </button>
            <button
              type="button"
              onClick={handleStartNow}
              className="rounded-full px-5 py-2 text-sm font-extrabold text-[#10213c] shadow-[0_8px_18px_rgba(245,198,61,0.28)] transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: primaryColor }}
            >
              Sign Up
            </button>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#ddd4c6] bg-white md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div ref={menuRef} className="border-t border-[#e8e2d8] bg-[#f8f7f4] px-4 py-4 md:hidden">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowLogin(true);
                  setLoginError(null);
                  setLoginNotice(null);
                  setMobileMenuOpen(false);
                }}
                className="rounded-xl border border-[#ddd4c6] bg-white px-3 py-2 text-sm font-semibold text-[#1b1710]"
              >
                Login
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowSignup(true);
                  setSignupError(null);
                  setMobileMenuOpen(false);
                }}
                className="rounded-xl px-3 py-2 text-sm font-bold text-[#16120b]"
                style={{ backgroundColor: primaryColor }}
              >
                Sign Up
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-4 pb-40 pt-7 md:px-6 md:pb-16 md:pt-10">
        <section className="theme5-hero relative overflow-hidden rounded-[34px] border border-white px-5 py-9 sm:px-9 lg:px-12 lg:py-12">
          <div className="relative grid gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
            <div className="max-w-[620px]">
              <h1 className="text-[44px] font-extrabold leading-[1.02] tracking-[-0.055em] text-[#10213c] sm:text-[62px] lg:text-[68px]">
                Data that moves
                <span className="block" style={{ color: sectionAccent }}>with your day.</span>
              </h1>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={scrollToNetworkSection}
                  className="inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-extrabold text-[#10213c] shadow-[0_12px_24px_rgba(245,198,61,0.28)] transition-transform hover:-translate-y-0.5"
                  style={{ backgroundColor: primaryColor }}
                >
                  Buy data now <ChevronRight size={17} />
                </button>
                <button
                  type="button"
                  onClick={handleStartNow}
                  className="rounded-2xl border border-[#d8e2ef] bg-white/75 px-5 py-3.5 text-sm font-extrabold text-[#304561] transition hover:border-[#b7c9df] hover:bg-white"
                >
                  Create an account
                </button>
              </div>
            </div>

            <div className="flex w-full items-center lg:justify-end">
              <div className="flex w-full max-w-[500px] items-center justify-between gap-4 rounded-[28px] border border-white bg-white px-5 py-5 shadow-[0_20px_44px_rgba(30,59,106,0.12)] sm:px-7 sm:py-6">
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                    style={{ color: primaryColor, backgroundColor: primaryRgba(0.18) }}
                  >
                    <Signal size={23} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#697488]">{selectedNetworkName}</p>
                    <p className="mt-1 truncate text-lg font-extrabold text-[#162033]">{selectedBundleName}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-extrabold text-[#09a54e]">{formatCurrency(totalCharge, selectedPlan?.currency || "GHS")}</p>
                  <p className="mt-1 text-sm text-[#697488]">Ready to activate</p>
                </div>
              </div>
            </div>
            </div>
          </div>
        </section>

        <section id="network-section" className="mt-16 grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
          <div>
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: sectionAccent }}>01 · Pick your bundle</p>
                <h2 className="mt-2 text-[38px] font-extrabold leading-[1.04] tracking-[-0.04em] text-[#10213c] sm:text-[46px]">Start with your network.</h2>
                <p className="mt-3 max-w-[560px] text-[#71819a]">Select a network, add the recipient&apos;s number, then choose a bundle that fits.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-[#687b96]">
                <Clock3 size={15} style={{ color: sectionAccent }} />
                Usually delivered in minutes
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-2 md:gap-4">
              {networkCards.map((card) => {
                const isSelected = selectedNetworkKey === card.key;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setSelectedNetworkKey(card.key)}
                    className="group rounded-[24px] border p-3 text-left transition-all duration-300 hover:-translate-y-1 md:p-4"
                    style={{
                      borderColor: isSelected ? sectionAccent : "#e4e7ef",
                      background: isSelected
                        ? `linear-gradient(180deg, ${sectionAccentRgba(0.08)} 0%, rgba(255,255,255,0.98) 100%)`
                        : "#ffffff",
                      boxShadow: isSelected
                        ? `0 10px 20px ${sectionAccentRgba(0.1)}`
                        : "0 6px 18px rgba(15, 23, 43, 0.04)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl"
                        style={{
                          backgroundColor: isSelected ? sectionAccentRgba(0.12) : "#f4f7fb",
                        }}
                      >
                        <Image
                          src={card.icon}
                          alt={card.label}
                          width={44}
                          height={44}
                          loading="lazy"
                          className="h-8 w-auto max-w-[44px] object-contain"
                        />
                      </div>
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full border"
                        style={{
                          borderColor: isSelected ? sectionAccent : "#d7dce6",
                          backgroundColor: isSelected ? sectionAccent : "transparent",
                        }}
                      >
                        <span className="h-2 w-2 rounded-full bg-white" />
                      </span>
                    </div>
                    <div className="mt-5">
                      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#162033] md:text-sm">
                        {card.label}
                      </h3>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7d8797] md:text-[11px]">
                        {card.packageCount} package{card.packageCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="mt-4 text-[11px] leading-5 text-[#697488]">
                      {card.packageCount > 0 ? "Packages ready to order" : "No plans assigned yet"}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-[28px] border border-[#e2eaf4] bg-white p-4 shadow-[0_20px_44px_rgba(30,59,106,0.06)] sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#7688a2]">02 · Recipient details</p>
                  <p className="mt-1 text-sm font-bold text-[#10213c]">Who should receive the data?</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eff5ff]" style={{ color: sectionAccent }}><Headphones size={18} /></div>
              </div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8f836f]">
                Recipient&apos;s Number
              </label>
              <input
                type="tel"
                value={recipientNumber}
                onChange={(event) => setRecipientNumber(event.target.value)}
                placeholder="e.g. 054 123 4567"
                className="w-full rounded-2xl border border-[#dfe8f3] bg-[#fbfdff] px-4 py-3.5 text-sm font-medium text-[#10213c] outline-none transition focus:border-[var(--theme5-primary)] focus:ring-4 focus:ring-[#edf3ff]"
                style={{ ["--theme5-primary" as any]: sectionAccent } as React.CSSProperties}
              />

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8f836f]">
                    Choose Data Package
                  </p>
                  <p className="mt-1 text-sm text-[#697488]">
                    Showing plans currently mapped to {selectedNetworkName}.
                  </p>
                </div>
                {filteredPlans.length > 0 ? (
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]"
                    style={{
                      backgroundColor: sectionAccentRgba(0.1),
                      color: sectionAccent,
                    }}
                  >
                    {filteredPlans.length} live plan{filteredPlans.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              {filteredPlans.length > 0 ? (
                <>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {visiblePlans.map((plan) => {
                      const selected = selectedPlan?.id === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedPlan(plan)}
                          className="rounded-[22px] border px-4 py-4 text-left transition-all"
                          style={{
                            borderColor: selected ? sectionAccent : "#e4e8f0",
                            background: selected
                              ? `linear-gradient(180deg, ${sectionAccentRgba(0.07)} 0%, rgba(255,255,255,0.98) 100%)`
                              : "#fbfcfe",
                            boxShadow: selected
                              ? `0 10px 20px ${sectionAccentRgba(0.1)}`
                              : "inset 0 1px 0 rgba(255,255,255,0.9)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="block truncate text-base font-extrabold text-[#162033]">
                                  {plan.name}
                                </span>
                                <span
                                  className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                                  style={{
                                    backgroundColor: selected ? sectionAccent : "#e9eef9",
                                    color: selected ? "#ffffff" : "#52627c",
                                  }}
                                >
                                  {selected ? "Selected" : "Instant"}
                                </span>
                              </div>
                              <span className="mt-1 block truncate text-sm text-[#7a8392]">
                                {plan.dataAmount || plan.name}
                              </span>
                            </div>
                            <div className="shrink-0 text-right">
                              <span
                                className="block text-base font-extrabold"
                                style={{ color: selected ? sectionAccent : "#162033" }}
                              >
                                {formatCurrency(plan.price, plan.currency || "GHS")}
                              </span>
                              <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8d96a5]">
                                ready now
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!showAllPlans && hasMorePlans ? (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowAllPlans(true)}
                        className="rounded-full border px-5 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#1d180f] transition hover:opacity-90"
                        style={{ borderColor: sectionAccent, color: sectionAccent }}
                      >
                        Load more
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-3 rounded-xl border border-[#e5ddcf] bg-[#fbfaf8] px-4 py-4 text-sm text-[#746b5e]">
                  No data packages are assigned to this network yet.
                </div>
              )}
            </div>
          </div>

          <aside
            className="hidden w-full overflow-hidden self-start rounded-2xl p-4 text-white shadow-[0_18px_42px_rgba(15,23,43,0.3)] md:block sm:p-5"
            style={{ backgroundColor: deepSurfaceColor }}
          >
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
                {formatCurrency(totalCharge, selectedPlan?.currency || "GHS")}
              </p>
            </div>

            {isAuthenticated ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                      Account Wallet
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {walletLoading ? "Checking balance..." : `${formatCurrency(walletBalance.currentBalance, "GHS")} available`}
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      {walletLoading
                        ? "Please wait..."
                        : walletCanCover
                          ? "Enough for this order"
                          : "Insufficient for this order"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseWalletBalance((current) => !current)}
                    disabled={!selectedPlan || walletLoading}
                    className="relative h-8 w-14 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      borderColor: useWalletBalance ? primaryColor : "rgba(255,255,255,0.14)",
                      backgroundColor: useWalletBalance ? primaryColor : "rgba(255,255,255,0.08)",
                    }}
                    aria-pressed={useWalletBalance}
                    aria-label="Toggle wallet payment"
                  >
                    <span
                      className="absolute top-1 h-6 w-6 rounded-full bg-white transition-all"
                      style={{ left: useWalletBalance ? "1.85rem" : "0.2rem" }}
                    />
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleSecurePay}
              disabled={payActionDisabled}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-[#16120a] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {payButtonLabel}
            </button>

            <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
              Encrypted via Secure Payment
            </p>

            {checkoutMessage && (
              <div
                className="mt-3 rounded-xl border px-3 py-2 text-xs font-semibold"
                style={{
                  borderColor:
                    checkoutState === "success"
                      ? "rgba(34, 197, 94, 0.5)"
                      : checkoutState === "error"
                        ? "rgba(248, 113, 113, 0.55)"
                        : "rgba(255, 255, 255, 0.25)",
                  color:
                    checkoutState === "success"
                      ? "#86efac"
                      : checkoutState === "error"
                        ? "#fca5a5"
                        : "#fef3c7",
                }}
              >
                {checkoutMessage}
              </div>
            )}
          </aside>
        </section>

        <section className="mt-20 hidden md:block">
          <div className="rounded-[30px] p-8 text-center sm:p-12" style={{ backgroundColor: primaryColor }}>
            <h2 className="text-[44px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[#171208]">Join Happy Users</h2>
            <p className="mx-auto mt-4 max-w-[560px] text-base text-[#3b301e]">
              Start saving on your data bundles today. Fast delivery, 24/7 support, and the best rates in Ghana.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleStartNow}
                className="rounded-full bg-[#111111] px-7 py-3 text-sm font-bold text-white"
              >
                Contact Support
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e8e2d7] bg-[#f8f6f3] py-4 text-center text-xs text-[#887f72] md:py-3">
        copyright 2026 - VickyData
      </footer>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 text-white shadow-[0_-18px_42px_rgba(15,23,43,0.24)] backdrop-blur md:hidden"
        style={{ backgroundColor: "rgba(15, 23, 43, 0.96)" }}
      >
        <div className="mx-auto max-w-[1180px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                Order Summary
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {selectedNetworkName} • {selectedBundleName}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                Total Pay
              </p>
              <p className="mt-1 text-[24px] font-extrabold leading-none" style={{ color: primaryColor }}>
                {formatCurrency(totalCharge, selectedPlan?.currency || "GHS")}
              </p>
            </div>
          </div>

          {isAuthenticated ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                  Pay from wallet
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-white">
                  {walletLoading ? "Checking balance..." : formatCurrency(walletBalance.currentBalance, "GHS")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUseWalletBalance((current) => !current)}
                disabled={!selectedPlan || walletLoading}
                className="relative h-8 w-14 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  borderColor: useWalletBalance ? primaryColor : "rgba(255,255,255,0.14)",
                  backgroundColor: useWalletBalance ? primaryColor : "rgba(255,255,255,0.08)",
                }}
                aria-pressed={useWalletBalance}
                aria-label="Toggle wallet payment"
              >
                <span
                  className="absolute top-1 h-6 w-6 rounded-full bg-white transition-all"
                  style={{ left: useWalletBalance ? "1.85rem" : "0.2rem" }}
                />
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleSecurePay}
            disabled={payActionDisabled}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: primaryColor, color: deepSurfaceColor }}
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            {payButtonLabel}
          </button>
        </div>
      </div>

      <LoginModal
        open={showLogin}
        onClose={() => {
          setShowLogin(false);
          setLoginError(null);
          setLoginNotice(null);
        }}
        onSubmit={handleLogin}
        onResetPassword={handleResetPassword}
        onRegisterClick={() => {
          setShowLogin(false);
          setShowSignup(true);
          setSignupError(null);
        }}
        isSubmitting={isLoginSubmitting}
        error={loginError}
        notice={loginNotice}
        mobileSheet={true}
      />

      <SignupModal
        open={showSignup}
        onClose={() => {
          setShowSignup(false);
          setSignupError(null);
        }}
        onLoginClick={() => {
          setShowSignup(false);
          setShowLogin(true);
          setLoginError(null);
          setLoginNotice(null);
        }}
        phoneNumber={recipientNumber}
        editablePhoneNumber={true}
        onSubmit={handleSignup}
        isSubmitting={isSignupSubmitting}
        error={signupError}
        mobileSheet={true}
      />
    </div>
  );
};

export default Theme5;
