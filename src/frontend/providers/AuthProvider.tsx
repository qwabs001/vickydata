"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { UserRole } from "@/shared/types";

export interface AuthUser {
  id: string;
  username?: string;
  phoneNumber: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "vickydata.auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const persistUser = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
    if (typeof window === "undefined") return;
    if (nextUser) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthUser;
        setUser(parsed);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (!event.newValue) {
        setUser(null);
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue) as AuthUser;
        setUser(parsed);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    const refreshProfile = async () => {
      try {
        const response = await fetch(`/api/profile?userId=${user.id}`);
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.id) return;
        if (!isMounted) return;
        const nextUser: AuthUser = {
          id: data.id,
          username: data.username ?? user.username,
          phoneNumber: data.phoneNumber ?? user.phoneNumber,
          role: data.role ?? user.role
        };
        const changed =
          nextUser.username !== user.username ||
          nextUser.phoneNumber !== user.phoneNumber ||
          nextUser.role !== user.role;
        if (changed) {
          persistUser(nextUser);
        }
      } catch {
        // Ignore refresh errors; fall back to stored user.
      }
    };

    refreshProfile();
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.phoneNumber, user?.role, user?.username, persistUser]);

  const login = useCallback((nextUser: AuthUser) => {
    persistUser(nextUser);
  }, [persistUser]);

  const logout = useCallback(() => {
    persistUser(null);
  }, [persistUser]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      loading,
      login,
      logout
    }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}
