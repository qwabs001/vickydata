const CANONICAL_NETWORK_ICONS: Record<string, string> = {
  MTN: "/images/networks/MTN-Logo.png",
  TELECEL: "/images/networks/Telecel.webp",
  AIRTELTIGO: "/images/networks/airteltigo.png"
};

function normalize(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

export function getCanonicalNetworkName(value?: string | null): "MTN" | "TELECEL" | "AIRTELTIGO" | null {
  const normalized = normalize(value);
  if (!normalized) return null;

  if (normalized.includes("mtn")) return "MTN";
  if (normalized.includes("telecel") || normalized.includes("vodafone")) return "TELECEL";
  if (normalized.includes("airtel") || normalized.includes("tigo") || normalized.includes("at")) return "AIRTELTIGO";

  return null;
}

export function getCanonicalNetworkDisplayName(value?: string | null): string {
  const key = getCanonicalNetworkName(value);
  if (key === "MTN") return "MTN";
  if (key === "TELECEL") return "Telecel";
  if (key === "AIRTELTIGO") return "AirtelTigo";
  return value ?? "";
}

export function getNetworkLogoUrl(
  networkName?: string | null,
  fallbackLogoUrl?: string | null
): string | null {
  const key = getCanonicalNetworkName(networkName);
  if (key) return CANONICAL_NETWORK_ICONS[key];
  return fallbackLogoUrl ?? null;
}

export function getNetworkInitials(value?: string | null): string {
  const canonical = getCanonicalNetworkDisplayName(value);
  if (!canonical) return "NT";
  if (canonical === "AirtelTigo") return "AT";
  return canonical.slice(0, 3).toUpperCase();
}
