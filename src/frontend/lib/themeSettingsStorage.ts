export type ThemeSettings = {
  accent: string;
  primary: string;
  logoName?: string;
  logoUrl?: string;
};

const STORAGE_KEY = "vickydata.theme.settings";

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
  return trimmed || undefined;
};

const persistThemeSettings = (settings: ThemeSettings) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const loadThemeSettings = (): ThemeSettings => {
  if (typeof window === "undefined") {
    return { accent: DEFAULT_ACCENT, primary: DEFAULT_PRIMARY };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
      return {
        accent: normalizeHex(parsed.accent ?? DEFAULT_ACCENT, DEFAULT_ACCENT),
        primary: normalizeHex(parsed.primary ?? DEFAULT_PRIMARY, DEFAULT_PRIMARY),
        logoName: parsed.logoName,
        logoUrl: normalizeLogoUrl(parsed.logoUrl)
      };
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return {
    accent: DEFAULT_ACCENT,
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
