"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  DEFAULT_ACCENT,
  DEFAULT_PRIMARY,
  loadThemeSettings,
  saveThemeSettings
} from "@/frontend/lib/themeSettingsStorage";
import type { BrandTheme } from "@/backend/lib/theme";

export type FooterSettings = {
  copyright?: string;
  showLogo?: boolean;
  privacyUrl?: string;
  termsUrl?: string;
  contactUrl?: string;
};

export type ContactSettings = {
  whatsapp?: string;
  telegram?: string;
  messenger?: string;
  email?: string;
  phone?: string;
  customLabel?: string;
  customUrl?: string;
  showWidget?: boolean;
};

interface ThemeContextValue {
  accent: string;
  primary: string;
  logoUrl?: string;
  footer: FooterSettings;
  contact: ContactSettings;
  setAccent: (color: string) => void;
  setPrimary: (color: string) => void;
  setLogoUrl: (url: string) => void;
  resetAccent: () => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const normalizeHex = (value: string, fallback = DEFAULT_ACCENT) => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("#")) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed;
  }
  return `#${trimmed}`;
};

const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "");
  const value = clean.length === 3
    ? clean
        .split("")
        .map((char) => char + char)
        .join("")
    : clean;
  const num = parseInt(value, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
};

const applyAccent = (accent: string) => {
  if (typeof document === "undefined") return;
  const safeAccent = normalizeHex(accent, DEFAULT_ACCENT);
  const { r, g, b } = hexToRgb(safeAccent);
  document.documentElement.style.setProperty("--accent", safeAccent);
  document.documentElement.style.setProperty("--accent-rgb", `${r} ${g} ${b}`);
};

const applyPrimary = (primary: string) => {
  if (typeof document === "undefined") return;
  const safePrimary = normalizeHex(primary, DEFAULT_PRIMARY);
  const { r, g, b } = hexToRgb(safePrimary);
  document.documentElement.style.setProperty("--primary", safePrimary);
  document.documentElement.style.setProperty("--primary-rgb", `${r} ${g} ${b}`);
};

const DEFAULT_FAVICON = "/images/networks/ghbundlw.png?v=2";

const applyBrandIcon = (logoUrl?: string) => {
  if (typeof document === "undefined") return;
  const href = logoUrl || DEFAULT_FAVICON;
  const head = document.head;
  const rels = ["icon", "apple-touch-icon"];
  rels.forEach((rel) => {
    let link = head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      head.appendChild(link);
    }
    link.href = href;
  });
};

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: BrandTheme | null;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [accent, setAccentState] = useState(
    () => initialTheme?.accent ?? loadThemeSettings().accent ?? DEFAULT_ACCENT
  );
  const [primary, setPrimaryState] = useState(
    () => initialTheme?.primary ?? loadThemeSettings().primary ?? DEFAULT_PRIMARY
  );
  const [logoUrl, setLogoUrlState] = useState<string | undefined>(
    () => initialTheme?.logoUrl ?? undefined
  );
  const [footer, setFooterState] = useState<FooterSettings>({});
  const [contact, setContactState] = useState<ContactSettings>({});

  const refreshTheme = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const response = await fetch("/api/brand/theme", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json().catch(() => null);
      if (!data) return;
      const stored = loadThemeSettings();
      const nextAccent = data.accent ?? stored.accent;
      const nextPrimary = data.primary ?? stored.primary;
      const hasLogoKey = Object.prototype.hasOwnProperty.call(data, "logoUrl");
      const nextLogo = hasLogoKey
        ? (typeof data.logoUrl === "string" ? data.logoUrl.trim() : "")
        : (stored.logoUrl ?? "");
      setAccentState(nextAccent);
      setPrimaryState(nextPrimary);
      setLogoUrlState(nextLogo || undefined);
      applyAccent(nextAccent);
      applyPrimary(nextPrimary);
      applyBrandIcon(nextLogo || undefined);
      saveThemeSettings({
        accent: nextAccent,
        primary: nextPrimary,
        logoUrl: nextLogo || ""
      });
      if (data.footer) setFooterState(data.footer);
      if (data.contact) setContactState(data.contact);
    } catch {
      // ignore fetch errors and keep current theme
    }
  }, []);

  useEffect(() => {
    refreshTheme();
  }, [refreshTheme]);

  // Refresh theme when window regains focus or when theme is updated (localStorage event)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleFocus = () => {
      refreshTheme();
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "theme:refresh" || e.key === null) {
        refreshTheme();
      }
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);
    // Also listen for custom event for same-tab refresh
    const handleCustomRefresh = () => refreshTheme();
    window.addEventListener("theme:refresh", handleCustomRefresh);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("theme:refresh", handleCustomRefresh);
    };
  }, [refreshTheme]);

  const setAccent = useCallback((value: string) => {
    const nextAccent = normalizeHex(value, DEFAULT_ACCENT);
    setAccentState(nextAccent);
    saveThemeSettings({ accent: nextAccent });
    applyAccent(nextAccent);
  }, []);

  const setPrimary = useCallback((value: string) => {
    const nextPrimary = normalizeHex(value, DEFAULT_PRIMARY);
    setPrimaryState(nextPrimary);
    saveThemeSettings({ primary: nextPrimary });
    applyPrimary(nextPrimary);
  }, []);

  const setLogoUrl = useCallback((url: string) => {
    const next = url?.trim();
    setLogoUrlState(next || undefined);
    saveThemeSettings({ logoUrl: next ?? undefined });
    applyBrandIcon(next || undefined);
  }, []);

  const resetAccent = useCallback(() => {
    setAccent(DEFAULT_ACCENT);
  }, [setAccent]);

  const resetTheme = useCallback(() => {
    setAccent(DEFAULT_ACCENT);
    setPrimary(DEFAULT_PRIMARY);
    setLogoUrl("");
  }, [setAccent, setPrimary, setLogoUrl]);

  const value = useMemo(
    () => ({
      accent,
      primary,
      logoUrl,
      footer,
      contact,
      setAccent,
      setPrimary,
      setLogoUrl,
      resetAccent,
      resetTheme
    }),
    [accent, primary, logoUrl, footer, contact, setAccent, setPrimary, setLogoUrl, resetAccent, resetTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
