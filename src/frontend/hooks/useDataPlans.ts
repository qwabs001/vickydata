import { useEffect, useState } from "react";
import apiClient from "@/frontend/lib/apiClient";
import type { DataPlan } from "@/shared/types";

const fallbackPlans: DataPlan[] = [
  {
    id: "plan_2gb",
    networkId: "",
    name: "2GB",
    dataAmount: "2GB",
    dataInMB: 2048,
    price: 10,
    currency: "GHS",
    validity: "30 days",
    isActive: true,
    isFeatured: false,
    sortOrder: 1
  },
  {
    id: "plan_5gb",
    networkId: "",
    name: "5GB",
    dataAmount: "5GB",
    dataInMB: 5120,
    price: 20,
    currency: "GHS",
    validity: "30 days",
    isActive: true,
    isFeatured: true,
    sortOrder: 2
  },
  {
    id: "plan_10gb",
    networkId: "",
    name: "10GB",
    dataAmount: "10GB",
    dataInMB: 10240,
    price: 30,
    currency: "GHS",
    validity: "30 days",
    isActive: true,
    isFeatured: false,
    sortOrder: 3
  },
  {
    id: "plan_15gb",
    networkId: "",
    name: "15GB",
    dataAmount: "15GB",
    dataInMB: 15360,
    price: 40,
    currency: "GHS",
    validity: "30 days",
    isActive: true,
    isFeatured: false,
    sortOrder: 4
  }
];

export function useDataPlans(networkId?: string | null, networkName?: string | null) {
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!networkId) {
      setPlans([]);
      return;
    }

    let active = true;
    setLoading(true);
    apiClient
      .get<DataPlan[]>(`/data-plans?networkId=${networkId}`)
      .then((response) => {
        if (!active) return;
        setPlans(response.data);
      })
      .catch(() => {
        if (!active) return;
        setPlans([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [networkId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { plans, loading };
}

/** Fetches all active data plans (for landing page package counts and plan list). */
export function useAllDataPlans() {
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiClient
      .get<DataPlan[]>(`/data-plans?scope=public`)
      .then((response) => {
        if (!active) return;
        setPlans(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (!active) return;
        setPlans([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { plans, loading };
}
