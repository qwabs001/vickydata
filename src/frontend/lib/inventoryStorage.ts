export type StoredPlan = {
  name: string;
  network: string;
  price: number;
  validity: string;
  featured: boolean;
};

const DATA_PLANS_KEY = "bundlearena:dataPlans";
const LEGACY_DATA_PLANS_KEY = `${["kel", "data", "gh"].join("")}:dataPlans`;

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
  const raw = window.localStorage.getItem(DATA_PLANS_KEY);
  const legacyRaw = raw ? null : window.localStorage.getItem(LEGACY_DATA_PLANS_KEY);
  const parsed = safeParseArray<StoredPlan>(raw ?? legacyRaw);
  if (parsed && legacyRaw) {
    window.localStorage.setItem(DATA_PLANS_KEY, JSON.stringify(parsed));
    window.localStorage.removeItem(LEGACY_DATA_PLANS_KEY);
  }
  return parsed;
};

export const saveStoredPlans = (plans: StoredPlan[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DATA_PLANS_KEY, JSON.stringify(plans));
  window.localStorage.removeItem(LEGACY_DATA_PLANS_KEY);
};
