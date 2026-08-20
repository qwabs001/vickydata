export type StoredNetwork = {
  id: string;
  name: string;
  displayName: string;
  logoUrl: string;
  isActive: boolean;
  sortOrder: number;
};

const NETWORKS_KEY = "vickydata:networks";

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
  return safeParseArray<StoredNetwork>(raw);
};

export const saveStoredNetworks = (networks: StoredNetwork[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NETWORKS_KEY, JSON.stringify(networks));
};
