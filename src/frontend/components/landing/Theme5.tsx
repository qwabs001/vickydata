"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Database,
  Loader2,
  Lock,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useAllDataPlans, useDataPlans } from "@/frontend/hooks/useDataPlans";
import { useNetworks } from "@/frontend/hooks/useNetworks";
import { useTheme } from "@/frontend/providers/ThemeProvider";
import { formatCurrency, formatGhanaPhone } from "@/shared/utils/formatters";
import { isValidGhanaPhone } from "@/shared/utils/validators";
import { getDefaultRouteForRole } from "@/frontend/lib/authRoutes";
import { LoginModal } from "@/frontend/components/landing/LoginModal";
import { SignupModal } from "@/frontend/components/landing/SignupModal";
import type { DataPlan, Network } from "@/shared/types";

const NETWORK_CARD_CONFIG = [
  {
    key: "mtn",
    label: "MTN",
    icon: "/images/networks/MTN-Logo.png",
    matchers: ["mtn"],
    description: "Fast activations and broad coverage",
  },
  {
    key: "telecel",
    label: "Telecel",
    icon: "/images/networks/Telecel.webp",
    matchers: ["telecel", "vodafone"],
    description: "Reliable nationwide bundle delivery",
  },
  {
    key: "airteltigo",
    label: "AirtelTigo",
    icon: "/images/networks/airteltigo.png",
    matchers: ["airteltigo", "airtel", "tigo"],
    description: "Affordable options for everyday use",
  },
] as const;

type DataBundleNetworkKey = (typeof NETWORK_CARD_CONFIG)[number]["key"];

type NetworkCard = (typeof NETWORK_CARD_CONFIG)[number] & {
  matchedNetwork: Network | null;
  packageCount: number;
  startingPrice: number | null;
};

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const normalizeName = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const parsePlanSizeInGb = (plan: DataPlan): number | null => {
  const source = plan.dataAmount || plan.name || "";
  const gbMatch = source.trim().match(/^(\d+(?:\.\d+)?)\s*gb$/i);
  if (gbMatch) return Number(gbMatch[1]);

  const mbMatch = source.trim().match(/^(\d+(?:\.\d+)?)\s*mb$/i);
  if (mbMatch) return Number(mbMatch[1]) / 1024;

  return plan.dataInMB > 0 ? plan.dataInMB / 1024 : null;
};

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

const getRgbFromHex = (hex: string, fallback: { r: number; g: number; b: number }) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!match) return fallback;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
};

const toRgba = (rgb: { r: number; g: number; b: number }, alpha: number) =>
  `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

const getPlanBadge = (plan: DataPlan, index: number) => {
  if (index === 0) return "Best Value";
  if (plan.isFeatured) return "Popular";

  const size = parsePlanSizeInGb(plan);
  if (size !== null && size >= 10) return "Heavy Use";
  if (size !== null && size >= 5) return "Top Pick";
  return "Quick Buy";
};

const getPlanBenefits = (plan: DataPlan, networkName: string) => {
  const size = parsePlanSizeInGb(plan);
  const duration = plan.validity ? `${plan.validity} duration` : "30 days duration";
  const usageHint =
    size !== null && size >= 10
      ? `Built for heavier ${networkName} usage`
      : size !== null && size >= 5
        ? `Balanced for work, socials, and streaming`
        : `Great for fast everyday top-ups`;

  return [duration, "Instant activation", usageHint];
};

const getDisplayNetworkName = (network?: Network | null) =>
  network?.displayName?.replace(/\s+Ghana$/i, "") || network?.name || "Select network";

const Theme5: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, login } = useAuth();
  const { networks } = useNetworks();
  const { plans: allPlans, loading: allPlansLoading } = useAllDataPlans();
  const { logoUrl, footer: footerSettings, accent, primary } = useTheme();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [selectedNetworkKey, setSelectedNetworkKey] = useState<DataBundleNetworkKey | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [recipientNumber, setRecipientNumber] = useState("");
  const [checkoutState, setCheckoutState] = useState<"idle" | "processing" | "success" | "error">(
    "idle"
  );
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const brandName = "BundleArena";
  const primaryColor = primary || "#4b7dff";
  const accentColor = accent || "#f6c500";
  const primaryRgb = useMemo(
    () => getRgbFromHex(primaryColor, { r: 75, g: 125, b: 255 }),
    [primaryColor]
  );
  const accentRgb = useMemo(
    () => getRgbFromHex(accentColor, { r: 246, g: 197, b: 0 }),
    [accentColor]
  );

  const networkById = useMemo(() => new Map(networks.map((network) => [network.id, network])), [networks]);

  const networkCards = useMemo<NetworkCard[]>(() => {
    return NETWORK_CARD_CONFIG.map((card) => {
      const matchedNetwork =
        networks.find((network) => {
          const normalized = normalizeName(network.name);
          return card.matchers.some((matcher) => normalized.includes(matcher));
        }) || null;

      const packageCount = matchedNetwork
        ? allPlans.filter((plan) => plan.isActive && plan.networkId === matchedNetwork.id).length
        : 0;
      const startingPrice = matchedNetwork
        ? allPlans
            .filter((plan) => plan.isActive && plan.networkId === matchedNetwork.id)
            .reduce<number | null>(
              (lowest, plan) => (lowest === null || plan.price < lowest ? plan.price : lowest),
              null
            )
        : null;

      return {
        ...card,
        matchedNetwork,
        packageCount,
        startingPrice,
      };
    });
  }, [allPlans, networks]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("theme5-fonts")) return;
    const link = document.createElement("link");
    link.id = "theme5-fonts";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap";
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
    if (!networkCards.length) return;
    if (selectedNetworkKey && networkCards.some((card) => card.key === selectedNetworkKey)) return;

    const firstAvailable = networkCards.find((card) => card.packageCount > 0) ?? networkCards[0];
    setSelectedNetworkKey(firstAvailable.key);
  }, [networkCards, selectedNetworkKey]);

  const selectedNetworkCard = useMemo(
    () => networkCards.find((card) => card.key === selectedNetworkKey) || null,
    [networkCards, selectedNetworkKey]
  );

  const selectedNetwork = selectedNetworkCard?.matchedNetwork || null;
  const { plans: networkPlans, loading: networkPlansLoading } = useDataPlans(
    selectedNetwork?.id,
    selectedNetwork?.name
  );

  const sortedNetworkPlans = useMemo(() => {
    return [...networkPlans]
      .filter((plan) => plan.isActive)
      .sort(
        (left, right) =>
          Number(right.isFeatured) - Number(left.isFeatured) ||
          left.sortOrder - right.sortOrder ||
          left.price - right.price
      );
  }, [networkPlans]);

  const visiblePlans = showAllPlans ? sortedNetworkPlans : sortedNetworkPlans.slice(0, 3);
  const hasMorePlans = sortedNetworkPlans.length > 3;

  useEffect(() => {
    if (sortedNetworkPlans.length === 0) {
      setSelectedPlan(null);
      return;
    }

    setSelectedPlan((current) => {
      if (current && sortedNetworkPlans.some((plan) => plan.id === current.id)) {
        return current;
      }
      return sortedNetworkPlans[0];
    });
  }, [sortedNetworkPlans]);

  useEffect(() => {
    setShowAllPlans(false);
  }, [selectedNetwork?.id]);

  const featuredBundles = useMemo(() => {
    const activePlans = [...allPlans].filter((plan) => plan.isActive);
    const deduped = new Map<string, DataPlan>();

    activePlans
      .sort(
        (left, right) =>
          Number(right.isFeatured) - Number(left.isFeatured) ||
          left.price - right.price ||
          left.sortOrder - right.sortOrder
      )
      .forEach((plan) => {
        const key = `${plan.networkId}:${plan.name}`;
        if (!deduped.has(key)) {
          deduped.set(key, plan);
        }
      });

    return Array.from(deduped.values()).slice(0, 4);
  }, [allPlans]);

  const selectedNetworkName = getDisplayNetworkName(selectedNetwork);
  const selectedBundleName = selectedPlan?.dataAmount || selectedPlan?.name || "Select a plan";
  const totalCharge = selectedPlan?.price || 0;
  const formattedRecipient = recipientNumber.trim()
    ? formatGhanaPhone(digitsOnly(recipientNumber))
    : "024 123 4567";
  const footerCopyright =
    footerSettings.copyright?.trim() ||
    `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`;

  const statCards = [
    {
      label: "Networks live",
      value: String(networks.length || 3),
      note: "MTN, Telecel, AirtelTigo",
    },
    {
      label: "Bundle options",
      value: allPlansLoading ? "..." : String(allPlans.length || 0),
      note: "Freshly synced from your dashboard",
    },
    {
      label: "Checkout speed",
      value: "< 60s",
      note: "From bundle selection to payment",
    },
  ];

  const trustItems = [
    "Instant delivery",
    "Paystack & Mobile Money",
    "Rewards on completed orders",
  ];

  const footerLinks = [
    { label: "Terms of Service", href: footerSettings.termsUrl?.trim() || "#" },
    { label: "Privacy Policy", href: footerSettings.privacyUrl?.trim() || "#" },
    { label: "Contact Support", href: footerSettings.contactUrl?.trim() || "#" },
  ];

  const scrollToSection = (id: string) => {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileMenuOpen(false);
  };

  const handleSupportClick = () => {
    const contactUrl = footerSettings.contactUrl?.trim();
    if (contactUrl && typeof window !== "undefined") {
      window.open(contactUrl, "_blank", "noopener,noreferrer");
      return;
    }
    scrollToSection("support-section");
  };

  const handleStartNow = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setShowSignup(true);
    setSignupError(null);
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
    } catch {
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
    } catch {
      setLoginError("Unable to reset password.");
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const handleSelectFeaturedBundle = (plan: DataPlan) => {
    const network = networkById.get(plan.networkId);
    const networkKey = resolveNetworkKeyFromText(network?.name || network?.displayName);

    if (networkKey) {
      setSelectedNetworkKey(networkKey);
    }
    setShowAllPlans(true);
    setSelectedPlan(plan);
    scrollToSection("order-panel");
  };

  const handleSecurePay = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!isAuthenticated || !user?.id) {
      setCheckoutState("error");
      setCheckoutMessage("Please login first to complete payment and create your order.");
      setShowLogin(true);
      setLoginError(null);
      setLoginNotice(null);
      return;
    }

    if (!selectedPlan || !selectedNetwork) {
      setCheckoutState("error");
      setCheckoutMessage("Select a network and data bundle first.");
      return;
    }

    const cleanRecipient = digitsOnly(recipientNumber);
    if (!isValidGhanaPhone(cleanRecipient)) {
      setCheckoutState("error");
      setCheckoutMessage("Enter a valid Ghana phone number before payment.");
      return;
    }

    setIsSubmitting(true);
    setCheckoutState("processing");
    setCheckoutMessage("Initializing payment...");

    try {
      const ref = `ORDER-${user.id}-${Date.now()}`;
      const response = await fetch("/api/payments/paystack/initialize", {
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
      setCheckoutMessage("Unable to open the payment page. Please try again.");
    } catch (error: any) {
      setCheckoutState("error");
      setCheckoutMessage(error?.message || "Payment failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#f4f7fb] text-[#0f172a]"
      style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
    >
      <style>{`
        .theme5-canvas {
          background-image:
            radial-gradient(circle at 0% 0%, ${toRgba(primaryRgb, 0.16)}, transparent 34%),
            radial-gradient(circle at 100% 12%, ${toRgba(accentRgb, 0.14)}, transparent 26%),
            linear-gradient(180deg, #f6f8fc 0%, #f4f7fb 52%, #eef3fb 100%);
        }
        .theme5-card-shadow {
          box-shadow: 0 24px 60px rgba(33, 52, 88, 0.08);
        }
        .theme5-soft-border {
          border-color: rgba(255, 255, 255, 0.82);
        }
        .theme5-rise {
          animation: theme5-rise 720ms cubic-bezier(0.21, 0.98, 0.32, 1) both;
        }
        .theme5-float {
          animation: theme5-float 7.5s ease-in-out infinite;
        }
        .theme5-float-delayed {
          animation: theme5-float 8.8s ease-in-out infinite;
          animation-delay: 1.2s;
        }
        @keyframes theme5-rise {
          from {
            opacity: 0;
            transform: translateY(28px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes theme5-float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
      `}</style>

      <div className="theme5-canvas relative">
        <header className="sticky top-0 z-40 border-b border-[#dae3ef]/80 bg-[rgba(248,250,255,0.82)] backdrop-blur-xl">
          <div className="mx-auto flex h-[78px] w-full max-w-[1240px] items-center justify-between px-4 md:px-6">
            <button
              type="button"
              onClick={() => scrollToSection("hero-section")}
              className="flex items-center gap-3"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white text-slate-900 shadow-[0_12px_30px_rgba(40,64,105,0.12)]"
                style={{ color: primaryColor }}
              >
                {logoUrl && !logoFailed ? (
                  <Image
                    src={logoUrl}
                    alt={brandName}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-xl object-cover"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <Zap size={18} className="fill-current" />
                )}
              </span>
              <span
                className="text-lg font-extrabold tracking-[-0.03em] text-slate-900"
                style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif" }}
              >
                {brandName}
              </span>
            </button>

            <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
              <button type="button" onClick={() => scrollToSection("hero-section")} className="transition hover:text-slate-950">
                Home
              </button>
              <button type="button" onClick={() => scrollToSection("popular-bundles")} className="transition hover:text-slate-950">
                Bundles
              </button>
              <button type="button" onClick={handleSupportClick} className="transition hover:text-slate-950">
                Support
              </button>
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              <button
                type="button"
                onClick={() => {
                  if (isAuthenticated) {
                    router.push(getDefaultRouteForRole(user?.role));
                    return;
                  }
                  setShowLogin(true);
                  setLoginError(null);
                  setLoginNotice(null);
                }}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                {isAuthenticated ? "Dashboard" : "Login"}
              </button>
              <button
                type="button"
                onClick={handleStartNow}
                className="rounded-full px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_16px_32px_rgba(75,125,255,0.26)]"
                style={{ backgroundColor: primaryColor }}
              >
                Register
              </button>
            </div>

            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d8e2ee] bg-white md:hidden"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {mobileMenuOpen ? (
            <div className="border-t border-[#dde6f1] bg-[#f8faff] px-4 py-4 md:hidden">
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => scrollToSection("popular-bundles")}
                  className="rounded-2xl border border-[#dde6f1] bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700"
                >
                  Popular Bundles
                </button>
                <button
                  type="button"
                  onClick={handleSupportClick}
                  className="rounded-2xl border border-[#dde6f1] bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700"
                >
                  Support
                </button>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogin(true);
                      setLoginError(null);
                      setLoginNotice(null);
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-2xl border border-[#dde6f1] bg-white px-4 py-3 text-sm font-semibold text-slate-800"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      handleStartNow(event);
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-2xl px-4 py-3 text-sm font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Register
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-8 md:px-6 md:pb-20 md:pt-12">
          <section id="hero-section" className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] xl:gap-10">
            <div className="theme5-rise">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500 theme5-card-shadow">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                Bundle checkout redesigned
              </div>

              <div className="mt-7 max-w-[40rem]">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Fast. Secure. Always light.
                </p>
                <h1
                  className="mt-3 text-[clamp(3.05rem,8vw,5.85rem)] font-extrabold leading-[0.94] tracking-[-0.05em] text-slate-950"
                  style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif" }}
                >
                  Welcome to{" "}
                  <span style={{ color: primaryColor }}>
                    {brandName}
                  </span>
                </h1>
                <p className="mt-5 max-w-[34rem] text-lg leading-8 text-slate-600">
                  Buy MTN, Telecel, and AirtelTigo bundles with cleaner pricing, instant
                  activation, and a checkout flow designed to get you from selection to payment in
                  under a minute.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => scrollToSection("order-panel")}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-extrabold text-white shadow-[0_18px_36px_rgba(75,125,255,0.24)]"
                  style={{ backgroundColor: primaryColor }}
                >
                  Order a bundle
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection("popular-bundles")}
                  className="inline-flex items-center gap-2 rounded-full border border-[#d8e4f2] bg-white px-6 py-3 text-sm font-bold text-slate-800"
                >
                  Browse popular bundles
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="mt-10 grid gap-4 lg:grid-cols-[1.28fr_0.72fr]">
                <div
                  className="theme5-card-shadow theme5-float relative overflow-hidden rounded-[32px] border border-white/80 p-6 text-white md:p-8"
                  style={{
                    background: `linear-gradient(145deg, ${toRgba(primaryRgb, 0.96)} 0%, #5f8eff 44%, #6b7cff 100%)`,
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `radial-gradient(circle at 18% 14%, ${toRgba(accentRgb, 0.18)}, transparent 24%),
                        radial-gradient(circle at 88% 74%, rgba(255,255,255,0.16), transparent 26%)`,
                    }}
                  />

                  <div className="relative">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/90">
                      <Sparkles size={14} />
                      Live in Ghana
                    </div>

                    <div className="relative mt-7 flex min-h-[280px] items-center justify-center overflow-hidden rounded-[28px] border border-white/18 bg-white/12 p-8">
                      <div className="theme5-float-delayed absolute -left-4 top-10 rounded-2xl border border-white/16 bg-white/14 px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur">
                        Instant delivery
                      </div>
                      <div className="theme5-float absolute right-5 top-6 rounded-full border border-white/16 bg-white/16 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/90 backdrop-blur">
                        Paystack + MoMo
                      </div>
                      <div className="theme5-float-delayed absolute bottom-5 left-6 rounded-2xl border border-white/16 bg-white/14 px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur">
                        {allPlansLoading ? "..." : `${allPlans.length} live plans`}
                      </div>

                      <div className="flex h-32 w-32 items-center justify-center rounded-[34px] border border-white/24 bg-white/16 shadow-[0_30px_60px_rgba(17,33,76,0.22)] backdrop-blur">
                        <Database className="h-14 w-14 text-white" strokeWidth={1.8} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  {statCards.map((card, index) => (
                    <div
                      key={card.label}
                      className="theme5-card-shadow theme5-rise rounded-[28px] border border-white/80 bg-white/86 p-5 backdrop-blur"
                      style={{ animationDelay: `${index * 90}ms` }}
                    >
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
                        {card.label}
                      </p>
                      <p
                        className="mt-3 text-[2rem] font-extrabold leading-none text-slate-950"
                        style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif" }}
                      >
                        {card.value}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{card.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {trustItems.map((item) => (
                  <div
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/75 px-4 py-2 text-sm font-semibold text-slate-700 theme5-card-shadow"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div id="order-panel" className="theme5-rise" style={{ animationDelay: "120ms" }}>
              <div className="theme5-card-shadow relative overflow-hidden rounded-[32px] border border-white/80 bg-white/92 p-6 backdrop-blur md:p-7">
                <div
                  className="absolute inset-x-0 top-0 h-40"
                  style={{
                    background: `radial-gradient(circle at top, ${toRgba(primaryRgb, 0.12)}, transparent 70%)`,
                  }}
                />

                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
                        Smart checkout
                      </p>
                      <h2
                        className="mt-2 text-[2rem] font-extrabold leading-tight text-slate-950"
                        style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif" }}
                      >
                        Order Your Data
                      </h2>
                      <p className="mt-2 max-w-[26rem] text-sm leading-6 text-slate-600">
                        Complete the steps below to top up your line with a light, frictionless
                        payment flow.
                      </p>
                    </div>

                    <div className="hidden rounded-2xl border border-[#e7eef8] bg-[#f6f9ff] px-4 py-3 text-right sm:block">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                        Active on site
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {allPlansLoading ? "..." : `${allPlans.length} plans`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
                      1. Select Network
                    </p>
                    <div className="mt-3 rounded-[28px] border border-[#dce6f3] bg-[#eff4fb] p-2">
                      <div className="grid grid-cols-3 gap-2">
                        {networkCards.map((card) => {
                          const selected = selectedNetworkKey === card.key;
                          return (
                            <button
                              key={card.key}
                              type="button"
                              onClick={() => setSelectedNetworkKey(card.key)}
                              className="rounded-[22px] border px-3 py-3 text-left transition"
                              style={{
                                borderColor: selected ? toRgba(primaryRgb, 0.28) : "transparent",
                                backgroundColor: selected ? "#ffffff" : "transparent",
                                boxShadow: selected ? "0 10px 24px rgba(54, 81, 122, 0.08)" : "none",
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white">
                                  <Image
                                    src={card.icon}
                                    alt={card.label}
                                    width={28}
                                    height={28}
                                    className="h-7 w-7 object-contain"
                                  />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-extrabold text-slate-900">
                                    {card.label}
                                  </span>
                                  <span className="block truncate text-xs text-slate-500">
                                    {card.packageCount} bundle{card.packageCount === 1 ? "" : "s"}
                                  </span>
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-7">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
                        2. Choose Plan
                      </p>
                      {selectedNetworkCard?.startingPrice != null ? (
                        <span className="text-xs font-semibold text-slate-500">
                          Starts at {formatCurrency(selectedNetworkCard?.startingPrice ?? 0, "GHS")}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-3">
                      {networkPlansLoading ? (
                        Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-[108px] animate-pulse rounded-[24px] border border-[#e7edf6] bg-[#f7faff]"
                          />
                        ))
                      ) : visiblePlans.length > 0 ? (
                        visiblePlans.map((plan, index) => {
                          const selected = selectedPlan?.id === plan.id;
                          return (
                            <button
                              key={plan.id}
                              type="button"
                              onClick={() => setSelectedPlan(plan)}
                              className="w-full rounded-[24px] border px-5 py-4 text-left transition"
                              style={{
                                borderColor: selected ? toRgba(primaryRgb, 0.38) : "#e5ebf5",
                                backgroundColor: selected ? toRgba(primaryRgb, 0.07) : "#ffffff",
                                boxShadow: selected ? "0 18px 34px rgba(74, 103, 160, 0.08)" : "none",
                              }}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-xl font-extrabold text-slate-950">
                                      {plan.dataAmount || plan.name}
                                    </span>
                                    <span
                                      className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em]"
                                      style={{
                                        backgroundColor: selected
                                          ? toRgba(primaryRgb, 0.14)
                                          : "#eef4ff",
                                        color: selected ? primaryColor : "#4a6ab3",
                                      }}
                                    >
                                      {getPlanBadge(plan, index)}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm text-slate-500">
                                    {plan.validity ? `Valid for ${plan.validity}` : "Valid for 30 days"} •
                                    {" "}Instant activation
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p
                                    className="text-2xl font-extrabold tracking-[-0.03em]"
                                    style={{
                                      color: selected ? primaryColor : "#0f172a",
                                      fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif",
                                    }}
                                  >
                                    {formatCurrency(plan.price, plan.currency || "GHS")}
                                  </p>
                                  {plan.isFeatured ? (
                                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                                      Popular
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-[#dbe5f2] bg-[#f8fbff] px-5 py-8 text-sm text-slate-500">
                          No active plans are assigned to this network yet.
                        </div>
                      )}
                    </div>

                    {!networkPlansLoading && hasMorePlans ? (
                      <div className="mt-4 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setShowAllPlans((prev) => !prev)}
                          className="rounded-full border border-[#dbe6f3] bg-white px-5 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-700"
                        >
                          {showAllPlans ? "Show less" : "Load more"}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-7">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
                      3. Phone Number
                    </p>
                    <label className="mt-3 flex items-center gap-3 rounded-[24px] border border-[#dbe5f2] bg-[#f6f9ff] px-4 py-4">
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: toRgba(primaryRgb, 0.12), color: primaryColor }}
                      >
                        <ShieldCheck size={18} />
                      </span>
                      <input
                        type="tel"
                        value={recipientNumber}
                        onChange={(event) => setRecipientNumber(formatGhanaPhone(event.target.value))}
                        placeholder="024 123 4567"
                        className="w-full bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </label>
                  </div>

                  <div className="mt-6 rounded-[28px] border border-[#e6ecf5] bg-[#f8fbff] p-5">
                    <div className="grid gap-3 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-4">
                        <span>Network</span>
                        <span className="font-semibold text-slate-900">{selectedNetworkName}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Bundle</span>
                        <span className="font-semibold text-slate-900">{selectedBundleName}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Phone Number</span>
                        <span className="font-semibold text-slate-900">{formattedRecipient}</span>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-[#e1e8f2] pt-4">
                      <p className="text-sm text-slate-500">Total to pay</p>
                      <p
                        className="mt-2 text-[2.45rem] font-extrabold leading-none tracking-[-0.05em]"
                        style={{ color: primaryColor, fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif" }}
                      >
                        {formatCurrency(totalCharge, selectedPlan?.currency || "GHS")}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSecurePay}
                    disabled={!selectedPlan || isSubmitting}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[24px] px-5 py-4 text-base font-extrabold text-white shadow-[0_18px_36px_rgba(75,125,255,0.22)] transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                    {isSubmitting
                      ? "Processing payment..."
                      : isAuthenticated
                        ? "Pay Now"
                        : "Login to Pay"}
                  </button>

                  <p className="mt-3 text-center text-[11px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                    Secured by Paystack & Mobile Money
                  </p>

                  {checkoutMessage ? (
                    <div
                      className="mt-4 rounded-[22px] border px-4 py-3 text-sm font-semibold"
                      style={{
                        borderColor:
                          checkoutState === "success"
                            ? "rgba(34, 197, 94, 0.28)"
                            : checkoutState === "error"
                              ? "rgba(248, 113, 113, 0.28)"
                              : "rgba(75, 125, 255, 0.24)",
                        color:
                          checkoutState === "success"
                            ? "#15803d"
                            : checkoutState === "error"
                              ? "#dc2626"
                              : "#1d4ed8",
                        backgroundColor:
                          checkoutState === "success"
                            ? "rgba(34, 197, 94, 0.08)"
                            : checkoutState === "error"
                              ? "rgba(248, 113, 113, 0.08)"
                              : "rgba(75, 125, 255, 0.08)",
                      }}
                    >
                      {checkoutMessage}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="theme5-card-shadow rounded-[24px] border border-white/80 bg-white/82 p-4">
                  <p className="text-sm font-bold text-slate-900">Fast activation</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Orders go straight from plan selection to secure payment and delivery.
                  </p>
                </div>
                <div className="theme5-card-shadow rounded-[24px] border border-white/80 bg-white/82 p-4">
                  <p className="text-sm font-bold text-slate-900">Always supported</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Need help? Use the support action below and we&apos;ll route you fast.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section id="popular-bundles" className="mt-20">
            <div className="theme5-card-shadow rounded-[32px] border border-white/80 bg-white/88 p-6 backdrop-blur md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
                    Popular Bundles
                  </p>
                  <h2
                    className="mt-2 text-[2rem] font-extrabold tracking-[-0.04em] text-slate-950 md:text-[2.4rem]"
                    style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif" }}
                  >
                    Our best-selling data plans right now
                  </h2>
                  <p className="mt-2 max-w-[36rem] text-sm leading-6 text-slate-600">
                    Pick a highlighted bundle below and we&apos;ll sync it straight into the order
                    panel for a faster checkout.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => scrollToSection("order-panel")}
                  className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-700 transition hover:text-slate-950"
                >
                  View order panel
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {featuredBundles.map((plan, index) => {
                  const network = networkById.get(plan.networkId);
                  const networkName = getDisplayNetworkName(network);
                  const benefits = getPlanBenefits(plan, networkName);
                  const highlighted = selectedPlan?.id === plan.id || index === 1 || plan.isFeatured;

                  return (
                    <article
                      key={plan.id}
                      className="relative overflow-hidden rounded-[28px] border bg-white p-5 transition"
                      style={{
                        borderColor: highlighted ? toRgba(accentRgb, 0.95) : "#e5ebf4",
                        boxShadow: highlighted
                          ? `0 24px 44px ${toRgba(accentRgb, 0.18)}`
                          : "0 14px 32px rgba(34, 52, 88, 0.06)",
                        background: highlighted
                          ? `linear-gradient(180deg, ${toRgba(accentRgb, 0.12)} 0%, rgba(255,255,255,0.96) 42%)`
                          : "#ffffff",
                      }}
                    >
                      <div
                        className="inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em]"
                        style={{
                          backgroundColor: highlighted ? accentColor : "#eef3fb",
                          color: highlighted ? "#1f2937" : "#60708a",
                        }}
                      >
                        {getPlanBadge(plan, index)}
                      </div>

                      <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
                        {networkName}
                      </p>
                      <h3
                        className="mt-2 text-[2rem] font-extrabold tracking-[-0.05em] text-slate-950"
                        style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif" }}
                      >
                        {plan.dataAmount || plan.name}
                      </h3>
                      <p className="mt-2 text-[1.7rem] font-extrabold text-slate-950">
                        {formatCurrency(plan.price, plan.currency || "GHS")}
                      </p>

                      <ul className="mt-5 space-y-3">
                        {benefits.map((benefit) => (
                          <li key={benefit} className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="mt-[3px] flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                              <Check size={10} strokeWidth={3} />
                            </span>
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        onClick={() => handleSelectFeaturedBundle(plan)}
                        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-extrabold transition"
                        style={{
                          backgroundColor: highlighted ? accentColor : "#eef2f8",
                          color: "#0f172a",
                        }}
                      >
                        {selectedPlan?.id === plan.id ? "Selected" : highlighted ? "Pay Now" : "Buy Now"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="support-section" className="mt-20">
            <div className="theme5-card-shadow overflow-hidden rounded-[32px] border border-white/80 bg-white/88 p-6 backdrop-blur md:p-8">
              <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
                    Support & Confidence
                  </p>
                  <h2
                    className="mt-3 text-[2rem] font-extrabold tracking-[-0.04em] text-slate-950 md:text-[2.3rem]"
                    style={{ fontFamily: "'Sora', 'Plus Jakarta Sans', sans-serif" }}
                  >
                    Designed to feel effortless after the first tap.
                  </h2>
                  <p className="mt-4 max-w-[34rem] text-sm leading-7 text-slate-600">
                    Everything on this page is built to keep the purchase flow clear: live plan
                    selection, readable totals, secure payment, and a support path when you need
                    one.
                  </p>

                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => scrollToSection("order-panel")}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Start ordering
                      <ArrowRight size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSupportClick}
                      className="inline-flex items-center gap-2 rounded-full border border-[#dae4f1] bg-white px-5 py-3 text-sm font-bold text-slate-800"
                    >
                      Contact support
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    {
                      title: "Secure payments",
                      body: "Paystack-backed flows with mobile money friendly checkout steps.",
                    },
                    {
                      title: "Clear bundle choices",
                      body: "Network-first filtering keeps the bundle list fast and readable.",
                    },
                    {
                      title: "Always-on support",
                      body: "Support links stay visible so help is one tap away whenever needed.",
                    },
                  ].map((item, index) => (
                    <div
                      key={item.title}
                      className="rounded-[28px] border border-[#e5ecf5] bg-[#f8fbff] p-5"
                      style={{
                        transform: index === 1 ? "translateY(8px)" : "none",
                      }}
                    >
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl"
                        style={{
                          backgroundColor: index === 1 ? toRgba(accentRgb, 0.18) : toRgba(primaryRgb, 0.12),
                          color: index === 1 ? "#b88900" : primaryColor,
                        }}
                      >
                        {index === 0 ? <Lock size={18} /> : index === 1 ? <Sparkles size={18} /> : <ShieldCheck size={18} />}
                      </div>
                      <p className="mt-4 text-base font-extrabold text-slate-950">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-[#dbe5f1] bg-[rgba(255,255,255,0.74)]">
          <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 py-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
            <p>{footerCopyright}</p>
            <div className="flex flex-wrap gap-4">
              {footerLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="font-semibold text-slate-600 transition hover:text-slate-950"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </footer>
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
