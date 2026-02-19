export type ThemeSettings = {
  accent: string;
  primary: string;
  logoName?: string;
  logoUrl?: string;
};

const STORAGE_KEY = "keldatagh.theme.settings";
const LEGACY_ACCENT_KEY = "keldatagh.theme.accent";

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
        logoUrl: parsed.logoUrl
      };
    } catch {
      // fall through to defaults
    }
  }

  const legacyAccent = window.localStorage.getItem(LEGACY_ACCENT_KEY) ?? DEFAULT_ACCENT;
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
    logoUrl: partial.logoUrl ?? current.logoUrl
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  if (partial.accent) {
    window.localStorage.setItem(LEGACY_ACCENT_KEY, next.accent);
  }
};
