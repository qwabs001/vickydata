import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/frontend/providers/AuthProvider";
import { ThemeProvider } from "@/frontend/providers/ThemeProvider";
import { LandingConfigProvider } from "@/frontend/providers/LandingConfigProvider";
import { ContactWidget } from "@/frontend/components/ContactWidget";
import { getBrandTheme, hexToRgbString } from "@/backend/lib/theme";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "900"] });
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://keldatagh.com";

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getBrandTheme();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: "Keldatagh | Buy Cheap Data Bundles in Ghana",
      template: "%s | Keldatagh"
    },
    description: "Buy cheap data bundles in Ghana. Instant MTN, Telecel, AirtelTigo top ups with secure payments and rewards.",
    keywords: [
      "buy data bundle Ghana",
      "cheap data Ghana",
      "MTN data",
      "Telecel data",
      "AirtelTigo data",
      "data bundle",
      "buy data online",
      "Keldatagh"
    ],
    alternates: {
      canonical: "/"
    },
    openGraph: {
      title: "Keldatagh | Buy Cheap Data Bundles in Ghana",
      description: "Instant data bundle purchases in Ghana with fast delivery and secure payments.",
      url: SITE_URL,
      siteName: "Keldatagh",
      images: theme.logoUrl ? [theme.logoUrl] : undefined,
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: "Keldatagh | Buy Cheap Data Bundles in Ghana",
      description: "Instant data bundle purchases in Ghana with fast delivery and secure payments.",
      images: theme.logoUrl ? [theme.logoUrl] : undefined
    },
    icons: theme.logoUrl ? { icon: theme.logoUrl, apple: theme.logoUrl } : undefined
  };
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const theme = await getBrandTheme();
  const themeStyles = {
    "--accent": theme.accent,
    "--accent-rgb": hexToRgbString(theme.accent),
    "--primary": theme.primary,
    "--primary-rgb": hexToRgbString(theme.primary)
  } as React.CSSProperties;

  return (
    <html lang="en" className="light" style={themeStyles} suppressHydrationWarning>
      <body
        className={`${inter.className} bg-background-light text-[#0d131c]`}
        suppressHydrationWarning
      >
        <ThemeProvider initialTheme={theme}>
          <LandingConfigProvider>
            <AuthProvider>{children}</AuthProvider>
          </LandingConfigProvider>
          <ContactWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
