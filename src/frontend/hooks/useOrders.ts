import { useCallback, useEffect, useState } from "react";
import type { OrderSummary } from "@/shared/types";
import { useAuth } from "@/frontend/hooks/useAuth";

type UseOrdersOptions = {
  paginated?: boolean;
  pageSize?: number;
};

export function useOrders(options: UseOrdersOptions = {}) {
  const { user } = useAuth();
  const paginated = options.paginated ?? false;
  const pageSize = options.pageSize ?? 20;
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (pageToLoad: number, append: boolean) => {
    if (!user?.id) {
      setOrders([]);
      setPage(1);
      setHasMore(false);
      return;
    }
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams({ userId: user.id });
      if (paginated) {
        params.set("limit", String(pageSize));
        params.set("page", String(pageToLoad));
      }
      const response = await fetch(`/api/orders?${params.toString()}`, {
        headers: { "x-user-id": user.id }
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to load orders.");
        setOrders([]);
        setHasMore(false);
        setPage(1);
        return;
      }
      const resolved = Array.isArray(data) ? data : data?.orders ?? [];
      const safeOrders = Array.isArray(resolved) ? resolved : [];
      setOrders((previous) => (append ? [...previous, ...safeOrders] : safeOrders));
      if (paginated) {
        setPage(pageToLoad);
        setHasMore(Boolean(data?.pagination?.hasMore));
      } else {
        setPage(1);
        setHasMore(false);
      }
    } catch {
      setError("Unable to load orders.");
      setOrders([]);
      setHasMore(false);
      setPage(1);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [pageSize, paginated, user?.id]);

  const refresh = useCallback(async () => {
    await fetchOrders(1, false);
  }, [fetchOrders]);

  const loadMore = useCallback(async () => {
    if (!paginated || !hasMore || loadingMore || loading) return;
    await fetchOrders(page + 1, true);
  }, [fetchOrders, hasMore, loading, loadingMore, page, paginated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;
    const hasInProgressOrder = orders.some((order) => order.status === "PROCESSING");
    if (!hasInProgressOrder) return;

    const intervalId = window.setInterval(() => {
      refresh();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [orders, refresh, user?.id]);

  return { orders, loading, error, refresh, loadMore, hasMore, loadingMore };
}
