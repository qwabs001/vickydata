export type StoredPlan = {
  name: string;
  network: string;
  price: number;
  validity: string;
  featured: boolean;
};

const DATA_PLANS_KEY = "keldatagh:dataPlans";

const safeParseArray = <T,>(raw: string | null): T[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
};

export const loadStoredPlans = (): StoredPlan[] | null => {
  if (typeof window === "undefined") return null;
  return safeParseArray<StoredPlan>(window.localStorage.getItem(DATA_PLANS_KEY));
};

export const saveStoredPlans = (plans: StoredPlan[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DATA_PLANS_KEY, JSON.stringify(plans));
};
