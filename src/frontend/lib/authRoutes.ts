import type { UserRole } from "@/shared/types";

export function getDefaultRouteForRole(role?: UserRole | null): string {
  if (role === "ADMIN") return "/admin";
  if (role === "AGENT") return "/agent";
  return "/dashboard";
}
