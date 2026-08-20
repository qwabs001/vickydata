import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";

const LOGO_KEY = "brand.logo";
const THEME_KEY = "brand.theme";

const DEFAULT_ACCENT = "#f6c500";
const DEFAULT_PRIMARY = "#2563eb";

export async function GET() {
  try {
    const [logoSetting, themeSetting] = await Promise.all([
      prisma.settings.findUnique({ where: { key: LOGO_KEY } }),
      prisma.settings.findUnique({ where: { key: THEME_KEY } })
    ]);

    const logoValue = logoSetting?.value as { logoUrl?: string } | null;
    const themeValue = themeSetting?.value as Record<string, unknown> | null;

    return NextResponse.json(
      {
        accent: (themeValue?.accent as string) ?? DEFAULT_ACCENT,
        primary: (themeValue?.primary as string) ?? DEFAULT_PRIMARY,
        logoUrl: logoValue?.logoUrl ?? null,
        footer: themeValue?.footer ?? {},
        contact: themeValue?.contact ?? {}
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120"
        }
      }
    );
  } catch (error) {
    console.error("Brand theme fetch error:", error);
    return NextResponse.json(
      { accent: DEFAULT_ACCENT, primary: DEFAULT_PRIMARY, logoUrl: null }
    );
  }
}
