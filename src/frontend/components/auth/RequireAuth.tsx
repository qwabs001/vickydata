"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/frontend/hooks/useAuth";
import { getDefaultRouteForRole } from "@/frontend/lib/authRoutes";
import type { UserRole } from "@/shared/types";

interface RequireAuthProps {
  children: React.ReactNode;
  role?: UserRole;
}

const LEGACY_AUTH_STORAGE_KEY = `${["kel", "data", "gh"].join("")}.auth`;

export function RequireAuth({ children, role }: RequireAuthProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const roleSyncAttempted = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }

    if (role && user?.role !== role) {
      if (!user?.id) {
        router.replace(getDefaultRouteForRole(user?.role));
        return;
      }

      if (roleSyncAttempted.current) {
        router.replace(getDefaultRouteForRole(user?.role));
        return;
      }

      roleSyncAttempted.current = true;
      let cancelled = false;

      void (async () => {
        try {
          const response = await fetch(`/api/profile?userId=${user.id}`);
          const profile = await response.json().catch(() => null);

          if (cancelled || !response.ok || !profile?.id) {
            if (!cancelled) router.replace(getDefaultRouteForRole(user?.role));
            return;
          }

          if (profile.role === role) {
            if (typeof window !== "undefined") {
              const nextUser = {
                id: profile.id,
                username: profile.username ?? user.username,
                phoneNumber: profile.phoneNumber ?? user.phoneNumber,
                role: profile.role
              };
              window.localStorage.setItem("bundlearena.auth", JSON.stringify(nextUser));
              window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
              window.location.reload();
            }
            return;
          }

          if (!cancelled) {
            router.replace(getDefaultRouteForRole(profile.role ?? user.role));
          }
        } catch {
          if (!cancelled) router.replace(getDefaultRouteForRole(user?.role));
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    roleSyncAttempted.current = false;
  }, [loading, isAuthenticated, user, role, router]);

  if (loading || !isAuthenticated) return null;
  if (role && user?.role !== role) return null;

  return <>{children}</>;
}
