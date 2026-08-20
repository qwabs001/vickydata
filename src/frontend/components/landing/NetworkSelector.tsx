import Image from "next/image";
import { cn } from "@/frontend/components/ui/utils";
import {
  getCanonicalNetworkDisplayName,
  getNetworkLogoUrl
} from "@/frontend/lib/networkBranding";
import type { Network } from "@/shared/types";

interface NetworkSelectorProps {
  networks: Network[];
  selectedId?: string | null;
  onSelect: (network: Network) => void;
}

const descriptions: Record<string, string> = {
  MTN: "Fast and reliable network",
  Telecel: "Quality nationwide coverage",
  AirtelTigo: "Affordable data solutions"
};

const mobileLabels: Record<string, string> = {
  MTN: "MTN",
  Telecel: "TELECEL",
  AirtelTigo: "AT"
};

export function NetworkSelector({
  networks,
  selectedId,
  onSelect
}: NetworkSelectorProps) {
  return (
    <section>
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        {networks.map((network) => {
          const selected = network.id === selectedId;
          const canonicalName = getCanonicalNetworkDisplayName(network.displayName || network.name) || network.name;
          const logoUrl = getNetworkLogoUrl(canonicalName, network.logoUrl) ?? "/images/networks/MTN-Logo.png";
          const mobileLabel = mobileLabels[canonicalName] ?? canonicalName.toUpperCase();
          return (
            <div
              key={network.id}
              className={cn(
                "group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm transition-all dark:border-gray-700 dark:bg-gray-800 md:gap-4 md:rounded-2xl md:p-6 md:shadow-[0_12px_30px_rgba(15,23,42,0.06)]",
                selected
                  ? "border-[#2563eb] md:border-primary"
                  : "hover:border-[#2563eb]/60 md:hover:border-primary/60"
              )}
              onClick={() => onSelect(network)}
            >
              <div
                className={cn(
                  "relative mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 md:h-20 md:w-20 md:rounded-2xl md:border-0 md:bg-transparent"
                )}
              >
                <Image
                  src={logoUrl ?? "/images/networks/MTN-Logo.png"}
                  alt={canonicalName}
                  width={64}
                  height={64}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="text-center">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-white md:text-lg md:normal-case md:tracking-normal">
                  <span className="md:hidden">{mobileLabel}</span>
                  <span className="hidden md:inline">{canonicalName}</span>
                </h3>
                <p className="hidden text-sm text-gray-500 dark:text-gray-400 md:block">
                  {descriptions[canonicalName] ?? "Reliable data services"}
                </p>
              </div>
              <div className={cn("absolute right-4 top-4 transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8.5 12.5l2.2 2.2 4.8-4.8" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
