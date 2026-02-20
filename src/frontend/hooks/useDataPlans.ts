import { useEffect, useState } from "react";
import apiClient from "@/frontend/lib/apiClient";
import type { DataPlan } from "@/shared/types";

const CACHE_TTL_MS = 60 * 1000;

let allPlansCache: DataPlan[] | null = null;
let allPlansFetchedAt = 0;
let allPlansPromise: Promise<DataPlan[]> | null = null;
const plansByNetworkCache = new Map<string, { plans: DataPlan[]; fetchedAt: number }>();
const plansByNetworkPromise = new Map<string, Promise<DataPlan[]>>();

const isFresh = (fetchedAt: number) => Date.now() - fetchedAt < CACHE_TTL_MS;

const indexPlansByNetwork = (plans: DataPlan[]) => {
  plansByNetworkCache.clear();
  const grouped = new Map<string, DataPlan[]>();

  for (const plan of plans) {
    const networkPlans = grouped.get(plan.networkId) ?? [];
    networkPlans.push(plan);
    grouped.set(plan.networkId, networkPlans);
  }

  const fetchedAt = Date.now();
  for (const [networkId, networkPlans] of grouped.entries()) {
    plansByNetworkCache.set(networkId, { plans: networkPlans, fetchedAt });
  }
};

const setAllPlansCache = (plans: DataPlan[]) => {
  allPlansCache = plans;
  allPlansFetchedAt = Date.now();
  indexPlansByNetwork(plans);
};

const getFreshPlansForNetwork = (networkId: string) => {
  const cached = plansByNetworkCache.get(networkId);
  if (!cached || !isFresh(cached.fetchedAt)) return null;
  return cached.plans;
};

const getFreshAllPlans = () => {
  if (!allPlansCache || !isFresh(allPlansFetchedAt)) return null;
  return allPlansCache;
};

const fetchAllPublicPlans = async () => {
  const cached = getFreshAllPlans();
  if (cached) return cached;
  if (allPlansPromise) return allPlansPromise;

  allPlansPromise = apiClient
    .get<DataPlan[]>("/data-plans?scope=public")
    .then((response) => {
      const plans = Array.isArray(response.data) ? response.data : [];
      setAllPlansCache(plans);
      return plans;
    })
    .finally(() => {
      allPlansPromise = null;
    });

  return allPlansPromise;
};

const fetchNetworkPlans = async (networkId: string) => {
  const cached = getFreshPlansForNetwork(networkId);
  if (cached) return cached;

  const inflight = plansByNetworkPromise.get(networkId);
  if (inflight) return inflight;

  const request = apiClient
    .get<DataPlan[]>(`/data-plans?networkId=${networkId}`)
    .then((response) => {
      const plans = Array.isArray(response.data) ? response.data : [];
      plansByNetworkCache.set(networkId, { plans, fetchedAt: Date.now() });
      return plans;
    })
    .finally(() => {
      plansByNetworkPromise.delete(networkId);
    });

  plansByNetworkPromise.set(networkId, request);
  return request;
};

export function useDataPlans(networkId?: string | null, networkName?: string | null) {
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Warm the public plans cache once so selecting a network can render instantly.
    void fetchAllPublicPlans().catch(() => {
      // no-op: network-scoped fetch will still run when needed
    });
  }, []);

  useEffect(() => {
    if (!networkId) {
      setPlans([]);
      setLoading(false);
      return;
    }

    const cachedNetworkPlans = getFreshPlansForNetwork(networkId);
    if (cachedNetworkPlans) {
      setPlans(cachedNetworkPlans);
      setLoading(false);
      return;
    }

    const cachedAllPlans = getFreshAllPlans();
    if (cachedAllPlans) {
      const scopedPlans = cachedAllPlans.filter((plan) => plan.networkId === networkId);
      setPlans(scopedPlans);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    fetchNetworkPlans(networkId)
      .then((response) => {
        if (!active) return;
        setPlans(response);
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
  }, [networkId, networkName]); // eslint-disable-line react-hooks/exhaustive-deps

  return { plans, loading };
}

/** Fetches all active data plans (for landing page package counts and plan list). */
export function useAllDataPlans() {
  const initialPlans = getFreshAllPlans() ?? [];
  const [plans, setPlans] = useState<DataPlan[]>(initialPlans);
  const [loading, setLoading] = useState(initialPlans.length === 0);

  useEffect(() => {
    let active = true;
    fetchAllPublicPlans()
      .then((allPlans) => {
        if (!active) return;
        setPlans(allPlans);
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
