"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bolt,
  Check,
  Loader2,
  Lock,
  Menu,
  Signal,
  Star,
  X,
} from "lucide-react";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useNetworks } from "@/frontend/hooks/useNetworks";
import { useAllDataPlans, useDataPlans } from "@/frontend/hooks/useDataPlans";
import { useWallet } from "@/frontend/hooks/useWallet";
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

function parsePlanSizeInGb(plan: DataPlan): number | null {
  const source = plan.dataAmount || plan.name || "";
  const match = source.trim().match(/^(\d+(?:\.\d+)?)\s*gb$/i);
  if (!match) return null;
  return Number(match[1]);
}

const HERO_TYPED_LINES = [
  { text: "Instant,", highlight: false },
  { text: "Affordable", highlight: false },
  { text: "Data Bundles", highlight: true },
  { text: "across Ghana.", highlight: false },
] as const;

const HERO_TYPED_TOTAL = HERO_TYPED_LINES.reduce((sum, line) => sum + line.text.length, 0);

const getSmmIcon = (id: string, title: string) => {
  const source = `${id} ${title}`.toLowerCase();
  if (source.includes("tiktok")) return "/images/networks/Tiktok_icon.svg.png";
  if (source.includes("instagram")) return "/images/networks/Instagram_icon.png.webp";
  if (source.includes("youtube")) return "/images/networks/youtube-logo.png";
  if (source.includes("facebook")) return "/images/networks/Facebook_Logo_(2019).png";
  return "/images/brand/bundlearena-icon.png";
};

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
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [recipientNumber, setRecipientNumber] = useState("");
  const [heroTypedCount, setHeroTypedCount] = useState(0);
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
  const smmAccent = "#18b7a1";
  const deepSurfaceColor = "#0F172B";
  const brandName = "BundleArena";

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timeout = window.setTimeout(() => {
      setHeroTypedCount((current) => (current >= HERO_TYPED_TOTAL ? 0 : current + 1));
    }, heroTypedCount >= HERO_TYPED_TOTAL ? 1500 : 60);
    return () => window.clearTimeout(timeout);
  }, [heroTypedCount]);

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

  const typedHeroLines = useMemo(() => {
    let remaining = heroTypedCount;
    return HERO_TYPED_LINES.map((line) => {
      const visibleCount = Math.max(0, Math.min(line.text.length, remaining));
      remaining = Math.max(0, remaining - line.text.length);
      return line.text.slice(0, visibleCount);
    });
  }, [heroTypedCount]);

  const activeHeroLineIndex = useMemo(() => {
    let remaining = heroTypedCount;
    for (let index = 0; index < HERO_TYPED_LINES.length; index += 1) {
      if (remaining < HERO_TYPED_LINES[index].text.length) {
        return index;
      }
      remaining -= HERO_TYPED_LINES[index].text.length;
    }
    return HERO_TYPED_LINES.length - 1;
  }, [heroTypedCount]);

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
        .theme5-glass-card {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.74) 0%, rgba(255, 255, 255, 0.44) 100%);
          border: 1px solid rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 18px 40px rgba(15, 23, 43, 0.14);
        }
        .theme5-wallet-primary {
          background: linear-gradient(145deg, #0f172b 0%, #16213f 52%, #203055 100%);
          box-shadow: 0 20px 46px rgba(15, 23, 43, 0.26);
        }
        .theme5-type-caret {
          display: inline-block;
          width: 0.12em;
          height: 0.9em;
          margin-left: 0.08em;
          vertical-align: -0.08em;
          animation: theme5-caret-blink 1s steps(2, start) infinite;
        }
        @keyframes theme5-caret-blink {
          0%, 49% {
            opacity: 1;
          }
          50%, 100% {
            opacity: 0;
          }
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

      <main className="mx-auto w-full max-w-[1180px] px-4 pb-40 pt-8 md:px-6 md:pb-14 md:pt-12">
        <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="theme5-grid-glow rounded-[28px] p-1">
            <div className="rounded-[24px] p-4 sm:p-7">
              <h1
                aria-label="Instant, Affordable Data Bundles across Ghana."
                className="text-[42px] font-extrabold leading-[1.04] tracking-[-0.02em] sm:text-[56px]"
              >
                {HERO_TYPED_LINES.map((line, index) => (
                  <span
                    key={line.text}
                    className="mb-1 block"
                  >
                    <span className="relative inline-block">
                      <span className="invisible">{line.text}</span>
                      <span
                        className="absolute left-0 top-0 whitespace-nowrap"
                        style={{ color: line.highlight ? primaryColor : "#19140c" }}
                      >
                        {typedHeroLines[index]}
                        {activeHeroLineIndex === index ? (
                          <span
                            className="theme5-type-caret"
                            style={{ backgroundColor: line.highlight ? primaryColor : "#19140c" }}
                          />
                        ) : null}
                      </span>
                    </span>
                  </span>
                ))}
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
            <div className="relative overflow-visible px-3 py-2 sm:px-4">
              <div
                className="absolute right-3 top-[-8px] inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold text-[#5a4e31] shadow-sm"
                style={{ borderColor: primaryRgba(0.35), backgroundColor: primaryRgba(0.12) }}
              >
                <Star size={12} className="fill-current" style={{ color: primaryColor }} />
                Bonus: +2GB
              </div>

              <p className="text-[17px] font-bold text-[#1c1710]">Bundle Wallet</p>

              <div className="relative mt-5 min-h-[286px] pb-20">
                <div className="theme5-wallet-primary relative rounded-[28px] p-6 text-white">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/68">Selected Bundle</p>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <span className="max-w-[65%] truncate text-[28px] font-extrabold leading-none">{selectedBundleName}</span>
                    <span className="mb-1 text-lg font-bold">{formatCurrency(totalCharge, selectedPlan?.currency || "GHS")}</span>
                  </div>

                  <div className="mt-8 h-[6px] w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full"
                      style={{ width: selectedPlan ? "72%" : "15%", backgroundColor: primaryColor }}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-white/68">
                    <span>Secure checkout ready</span>
                    <span>{selectedNetworkName}</span>
                  </div>
                </div>

                <div
                  className="theme5-glass-card absolute right-0 top-12 w-[168px] rounded-[26px] p-4"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(231, 236, 246, 0.92) 0%, rgba(187, 195, 214, 0.82) 100%)",
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5f6c82]">
                    Wallet Boost
                  </p>
                  <p className="mt-2 text-[28px] font-extrabold leading-none" style={{ color: primaryColor }}>
                    +2GB
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#5f6c82]">
                    Bonus applied to eligible orders.
                  </p>
                </div>

                <div className="absolute bottom-0 left-6 right-12 flex items-center justify-between gap-4 rounded-[26px] border border-white/80 bg-white px-5 py-4 shadow-[0_18px_36px_rgba(15,23,43,0.1)]">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full"
                      style={{ color: primaryColor, backgroundColor: primaryRgba(0.18) }}
                    >
                      <Signal size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#697488]">
                        {selectedNetworkName}
                      </p>
                      <p className="text-sm font-bold text-[#162033]">{selectedBundleName}</p>
                    </div>
                  </div>
                    <div className="text-right">
                    <p className="text-sm font-extrabold text-[#09a54e]">
                      {formatCurrency(totalCharge, selectedPlan?.currency || "GHS")}
                    </p>
                    <p className="text-xs text-[#697488]">
                      {checkoutState === "success" ? "Success" : "Ready to activate"}
                    </p>
                  </div>
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
                    className="rounded-[22px] border p-3 text-left transition-all md:p-4"
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

            <div className="mt-6 rounded-[26px] border border-[#e2e7f0] bg-white p-4 shadow-[0_18px_36px_rgba(15,23,43,0.04)] sm:p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8f836f]">
                Recipient&apos;s Number
              </label>
              <input
                type="tel"
                value={recipientNumber}
                onChange={(event) => setRecipientNumber(event.target.value)}
                placeholder="e.g. 054 123 4567"
                className="w-full rounded-xl border border-[#e1d8ca] bg-[#fbfaf8] px-4 py-3 text-sm outline-none transition focus:border-[var(--theme5-primary)]"
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

        {config.popularBundles.enabled ? (
        <section className="mt-20">
          <div className="rounded-[34px] border border-[#e8edf4] bg-[#f8fafc] p-5 shadow-[0_18px_40px_rgba(15,23,43,0.04)] sm:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-[32px] font-extrabold tracking-[-0.03em] text-[#182033] sm:text-[38px]">
                  {config.popularBundles.title}
                </h2>
                <p className="mt-2 text-base text-[#60708a]">
                  {config.popularBundles.subtitle}
                </p>
              </div>

              <a
                href={config.popularBundles.ctaUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition hover:opacity-90"
                style={{ borderColor: smmAccent, color: smmAccent }}
              >
                {config.popularBundles.ctaText}
                <ArrowRight size={16} />
              </a>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {config.popularBundles.items.map((service) => (
                <article
                  key={service.id}
                  className="relative rounded-[28px] border bg-white p-5 shadow-[0_12px_28px_rgba(15,23,43,0.04)]"
                  style={{
                    borderColor: service.isFeatured ? smmAccent : "#e8edf4",
                    boxShadow: service.isFeatured
                      ? "0 18px 40px rgba(24, 183, 161, 0.12)"
                      : "0 12px 28px rgba(15, 23, 43, 0.04)",
                  }}
                >
                  {service.isFeatured ? (
                    <span
                      className="absolute -top-3 right-5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white"
                      style={{ backgroundColor: smmAccent }}
                    >
                      Best Value
                    </span>
                  ) : null}

                  <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#f6f9fc] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <Image
                      src={getSmmIcon(service.id, service.title)}
                      alt={service.title}
                      width={56}
                      height={56}
                      className="h-12 w-12 object-contain"
                    />
                  </div>

                  <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.24em] text-[#8b97ab]">
                    {service.title}
                  </p>
                  <p className="mt-4 text-[28px] font-extrabold tracking-[-0.04em]" style={{ color: smmAccent }}>
                    {service.priceRange}
                  </p>
                  <p className="mt-2 min-h-[44px] text-sm leading-6 text-[#60708a]">
                    {service.description}
                  </p>

                  <ul className="mt-5 space-y-3">
                    {service.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-[#41506a]">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: smmAccent }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <a
                    href={config.popularBundles.buyNowUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-8 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-extrabold text-[#162033] transition hover:opacity-90"
                    style={{
                      backgroundColor: service.isFeatured ? smmAccent : "#eef3f8",
                      color: service.isFeatured ? "#ffffff" : "#233047",
                    }}
                  >
                    {service.ctaLabel}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
        ) : null}

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
        copyright 2026 - BundleArena
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
