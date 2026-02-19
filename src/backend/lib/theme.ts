import { cache } from "react";
import { prisma } from "@/backend/lib/db/prisma";

const LOGO_KEY = "brand.logo";
const THEME_KEY = "brand.theme";

export const DEFAULT_ACCENT = "#f6c500";
export const DEFAULT_PRIMARY = "#2563eb";

export type BrandTheme = {
  accent: string;
  primary: string;
  logoUrl: string | null;
};

export function hexToRgbString(hex: string): string {
  const clean = hex.replace("#", "");
  const value =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;
  const num = parseInt(value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r} ${g} ${b}`;
}

export const getBrandTheme = cache(async (): Promise<BrandTheme> => {
  try {
    const [logoSetting, themeSetting] = await Promise.all([
      prisma.settings.findUnique({ where: { key: LOGO_KEY } }),
      prisma.settings.findUnique({ where: { key: THEME_KEY } })
    ]);

    const logoValue = logoSetting?.value as { logoUrl?: string } | null;
    const themeValue = themeSetting?.value as { accent?: string; primary?: string } | null;

    return {
      accent: themeValue?.accent ?? DEFAULT_ACCENT,
      primary: themeValue?.primary ?? DEFAULT_PRIMARY,
      logoUrl: logoValue?.logoUrl ?? null
    };
  } catch (error) {
    console.error("Brand theme fetch error:", error);
    return {
      accent: DEFAULT_ACCENT,
      primary: DEFAULT_PRIMARY,
      logoUrl: null
    };
  }
});
