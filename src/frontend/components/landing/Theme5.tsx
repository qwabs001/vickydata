"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bolt,
  Loader2,
  Lock,
  Menu,
  Signal,
  Star,
  X,
} from "lucide-react";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useNetworks } from "@/frontend/hooks/useNetworks";
import { useDataPlans } from "@/frontend/hooks/useDataPlans";
import { useTheme } from "@/frontend/providers/ThemeProvider";
import { useLandingConfig } from "@/frontend/providers/LandingConfigProvider";
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

const Theme5: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, login } = useAuth();
  const { networks } = useNetworks();
  const { logoUrl, footer: footerSettings, accent, primary } = useTheme();
  const { config } = useLandingConfig();
  const menuRef = useRef<HTMLDivElement>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [selectedNetworkKey, setSelectedNetworkKey] = useState<DataBundleNetworkKey | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
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

  const { plans } = useDataPlans(selectedNetwork?.id, selectedNetwork?.name);

  const primaryColor = accent || primary || "#f5c63d";
  const brandName = "Keldatagh";

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
    const authParam = searchParams?.get("auth") || searchParams?.get("login");
    if (authParam === "login" && !isAuthenticated) {
      setShowLogin(true);
      setLoginError(null);
      setLoginNotice(null);
    }
  }, [searchParams, isAuthenticated]);

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

  const selectedNetworkName = selectedNetworkCard?.networkName || "Select network";
  const selectedBundleName = selectedPlan?.name || "Select package";
  const totalCharge = selectedPlan?.price || 0;

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
    setCheckoutMessage("Initializing payment...");

    try {
      const ref = `ORDER-${user.id}-${Date.now()}`;
      const response = await fetch("/api/payments/moolre/initialize", {
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

      <header className="sticky top-0 z-40 border-b border-[#e8e2d8] bg-[#f8f7f4]/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] w-full max-w-[1180px] items-center justify-between px-4 md:px-6">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#151208]"
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
            <span className="text-base font-extrabold tracking-tight text-[#16120a]">{brandName}</span>
          </button>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[#443c30] md:flex">
            <button
              type="button"
              className="transition-colors hover:text-[#1b1710]"
              onClick={() => scrollToNetworkSection()}
            >
              Network
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
              className="rounded-full px-4 py-2 text-sm font-semibold text-[#1a1610] transition-colors hover:bg-[#ebe6dc]"
            >
              {isAuthenticated ? "Dashboard" : "Login"}
            </button>
            <button
              type="button"
              onClick={handleStartNow}
              className="rounded-full px-5 py-2 text-sm font-extrabold text-[#18140b] shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)]"
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

      <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-8 md:px-6 md:pb-14 md:pt-12">
        <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="theme5-grid-glow rounded-[28px] p-1">
            <div className="rounded-[24px] p-4 sm:p-7">
              <h1 className="text-[42px] font-extrabold leading-[1.04] tracking-[-0.02em] text-[#19140c] sm:text-[56px]">
                Fast, Reliable
                <br />
                <span style={{ color: primaryColor }}>Data Bundles</span>
                <br />
                for Ghana.
              </h1>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToNetworkSection();
                  }}
                  className="rounded-2xl px-6 py-3 text-sm font-extrabold text-[#1a150b] shadow-[inset_0_-2px_0_rgba(0,0,0,0.16)]"
                  style={{ backgroundColor: primaryColor }}
                >
                  Get Started Now
                </button>
              </div>
            </div>
          </div>

          <div className="relative hidden md:block">
            <div className="theme5-surface relative rounded-[28px] border border-[#e7e0d4] bg-[#f9f8f6] p-4 sm:p-6">
              <div
                className="absolute right-4 top-[-18px] inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold text-[#5a4e31] shadow-sm"
                style={{ borderColor: primaryRgba(0.35), backgroundColor: primaryRgba(0.12) }}
              >
                <Star size={12} className="fill-current" style={{ color: primaryColor }} />
                Bonus: +2GB
              </div>

              <p className="text-[17px] font-bold text-[#1c1710]">Bundle Wallet</p>

              <div className="mt-4 rounded-2xl bg-[#181308] p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/70">Selected Bundle</p>
                <div className="mt-2 flex items-end justify-between">
                  <span className="max-w-[68%] truncate text-[24px] font-extrabold leading-none">{selectedBundleName}</span>
                  <span className="mb-1 text-base font-bold">{formatCurrency(totalCharge, selectedPlan?.currency || "GHS")}</span>
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
                  <p className="text-sm font-extrabold text-[#09a54e]">{formatCurrency(totalCharge, selectedPlan?.currency || "GHS")}</p>
                  <p className="text-xs text-[#8f836f]">{checkoutState === "success" ? "Success" : "Ready"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="network-section" className="mt-16 grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
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
                value={recipientNumber}
                onChange={(event) => setRecipientNumber(event.target.value)}
                placeholder="e.g. 054 123 4567"
                className="w-full rounded-xl border border-[#e1d8ca] bg-[#fbfaf8] px-4 py-3 text-sm outline-none transition focus:border-[var(--theme5-primary)]"
                style={{ ["--theme5-primary" as any]: primaryColor } as React.CSSProperties}
              />

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

            <button
              type="button"
              onClick={handleSecurePay}
              disabled={!selectedPlan || isSubmitting}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-[#16120a] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {isSubmitting ? "Processing Payment..." : isAuthenticated ? "Pay Securely Now" : "Login to Pay"}
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
        copyright 2026 - Keldatagh
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8e2d7] bg-[#f8f7f4]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setShowSignup(true);
            setSignupError(null);
          }}
          className="flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-extrabold text-[#17120a] shadow-[inset_0_-2px_0_rgba(0,0,0,0.16)]"
          style={{ backgroundColor: primaryColor }}
        >
          Create Free Account
        </button>
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
