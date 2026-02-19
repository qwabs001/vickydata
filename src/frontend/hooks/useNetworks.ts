import { useEffect, useState } from "react";
import apiClient from "@/frontend/lib/apiClient";
import type { Network } from "@/shared/types";

const fallbackNetworks: Network[] = [
  {
    id: "network_mtn",
    name: "MTN",
    displayName: "MTN Ghana",
    logoUrl: "/images/networks/MTN-Logo.png",
    isActive: true,
    sortOrder: 1
  },
  {
    id: "network_vodafone",
    name: "Telecel",
    displayName: "Telecel Ghana",
    logoUrl: "/images/networks/Telecel.webp",
    isActive: true,
    sortOrder: 2
  },
  {
    id: "network_airtel",
    name: "AirtelTigo",
    displayName: "AirtelTigo Ghana",
    logoUrl: "/images/networks/airteltigo.png",
    isActive: true,
    sortOrder: 3
  }
];

const normalizeNetwork = (network: Network): Network => {
  if (network.name !== "Vodafone") return network;
  return {
    ...network,
    name: "Telecel",
    displayName: network.displayName?.replace("Vodafone", "Telecel") ?? "Telecel Ghana",
    logoUrl: "/images/networks/Telecel.webp"
  };
};

export function useNetworks() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiClient
      .get<Network[]>("/networks")
      .then((response) => {
        if (!active) return;
        setNetworks(response.data.map(normalizeNetwork));
      })
      .catch(() => {
        if (!active) return;
        setNetworks(fallbackNetworks.map(normalizeNetwork));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { networks, loading };
}
