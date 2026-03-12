export type StoredNetwork = {
  id: string;
  name: string;
  displayName: string;
  logoUrl: string;
  isActive: boolean;
  sortOrder: number;
};

const NETWORKS_KEY = "bundlearena:networks";
const LEGACY_NETWORKS_KEY = `${["kel", "data", "gh"].join("")}:networks`;

const safeParseArray = <T,>(raw: string | null): T[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
};

export const loadStoredNetworks = (): StoredNetwork[] | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(NETWORKS_KEY);
  const legacyRaw = raw ? null : window.localStorage.getItem(LEGACY_NETWORKS_KEY);
  const parsed = safeParseArray<StoredNetwork>(raw ?? legacyRaw);
  if (parsed && legacyRaw) {
    window.localStorage.setItem(NETWORKS_KEY, JSON.stringify(parsed));
    window.localStorage.removeItem(LEGACY_NETWORKS_KEY);
  }
  return parsed;
};

export const saveStoredNetworks = (networks: StoredNetwork[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NETWORKS_KEY, JSON.stringify(networks));
  window.localStorage.removeItem(LEGACY_NETWORKS_KEY);
};
