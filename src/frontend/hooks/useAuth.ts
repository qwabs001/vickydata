import { useAuthContext } from "@/frontend/providers/AuthProvider";

export function useAuth() {
  return useAuthContext();
}
