export type ThemeSettings = {
  accent: string;
  primary: string;
  logoName?: string;
  logoUrl?: string;
};

const STORAGE_KEY = "bundlearena.theme.settings";
const LEGACY_BRAND_KEY = ["kel", "data", "gh"].join("");
const LEGACY_STORAGE_KEY = `${LEGACY_BRAND_KEY}.theme.settings`;
const LEGACY_ACCENT_KEYS = ["bundlearena.theme.accent", `${LEGACY_BRAND_KEY}.theme.accent`] as const;
const LEGACY_LOGO_URL = `/images/networks/${LEGACY_BRAND_KEY}.png`;
const PREVIOUS_DEFAULT_LOGO_URL = "/images/networks/bundlearena.png";

export const DEFAULT_ACCENT = "#f6c500";
export const DEFAULT_PRIMARY = "#2563eb";

const normalizeHex = (value: string, fallback: string) => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("#")) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed;
  }
  return `#${trimmed}`;
};

const normalizeLogoUrl = (value?: string) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  return trimmed === LEGACY_LOGO_URL || trimmed === PREVIOUS_DEFAULT_LOGO_URL
    ? "/images/brand/bundlearena-icon.png"
    : trimmed;
};

const persistThemeSettings = (settings: ThemeSettings) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  LEGACY_ACCENT_KEYS.forEach((key) => window.localStorage.removeItem(key));
};

export const loadThemeSettings = (): ThemeSettings => {
  if (typeof window === "undefined") {
    return { accent: DEFAULT_ACCENT, primary: DEFAULT_PRIMARY };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const legacyRaw = raw ? null : window.localStorage.getItem(LEGACY_STORAGE_KEY);
  const source = raw ?? legacyRaw;

  if (source) {
    try {
      const parsed = JSON.parse(source) as Partial<ThemeSettings>;
      const next = {
        accent: normalizeHex(parsed.accent ?? DEFAULT_ACCENT, DEFAULT_ACCENT),
        primary: normalizeHex(parsed.primary ?? DEFAULT_PRIMARY, DEFAULT_PRIMARY),
        logoName: parsed.logoName,
        logoUrl: normalizeLogoUrl(parsed.logoUrl)
      };
      if (legacyRaw) persistThemeSettings(next);
      return next;
    } catch {
      window.localStorage.removeItem(raw ? STORAGE_KEY : LEGACY_STORAGE_KEY);
    }
  }

  const legacyAccent =
    LEGACY_ACCENT_KEYS.map((key) => window.localStorage.getItem(key)).find((value): value is string => Boolean(value))
    ?? DEFAULT_ACCENT;
  return {
    accent: normalizeHex(legacyAccent, DEFAULT_ACCENT),
    primary: DEFAULT_PRIMARY
  };
};

export const saveThemeSettings = (partial: Partial<ThemeSettings>) => {
  if (typeof window === "undefined") return;
  const current = loadThemeSettings();
  const next: ThemeSettings = {
    accent: normalizeHex(partial.accent ?? current.accent, DEFAULT_ACCENT),
    primary: normalizeHex(partial.primary ?? current.primary, DEFAULT_PRIMARY),
    logoName: partial.logoName ?? current.logoName,
    logoUrl: normalizeLogoUrl(partial.logoUrl ?? current.logoUrl)
  };
  persistThemeSettings(next);
};
