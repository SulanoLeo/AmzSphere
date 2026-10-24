"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchListingAlerts, fetchListingHealthSummary } from "@/lib/listing-health";
import type {
  ListingHealthAlertItem,
  ListingHealthAlertsPage,
  ListingHealthSummary,
} from "@/lib/listing-health";

export interface ListingHealthFilters {
  is_suppressed?: boolean | null;
  marketplace_id?: string | null;
}

export interface ListingHealthState {
  summary: ListingHealthSummary | null;
  alerts: ListingHealthAlertItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setFilters: (filters: Partial<ListingHealthFilters>) => void;
}

export interface UseListingHealthOptions {
  refreshIntervalMs?: number;
  enabled?: boolean;
}

export function useListingHealth(
  options: UseListingHealthOptions = {},
): ListingHealthState {
  const { refreshIntervalMs = 60_000, enabled = true } = options;
  const [summary, setSummary] = useState<ListingHealthSummary | null>(null);
  const [alerts, setAlerts] = useState<ListingHealthAlertItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [limit, setLimitState] = useState(20);
  const [filters, setFiltersState] = useState<ListingHealthFilters>({
    is_suppressed: null,
    marketplace_id: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fetchAll = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    let cancelled = false;
    mountedRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const [summaryResult, alertsResult] = await Promise.all([
        fetchListingHealthSummary(),
        fetchListingAlerts(page, limit, filters),
      ]);
      if (cancelled || !mountedRef.current) return;
      setSummary(summaryResult);
      setAlerts(alertsResult.items);
      setTotal(alertsResult.total);
    } catch (cause) {
      if (cancelled || !mountedRef.current) return;
      setError(cause instanceof Error ? cause.message : "Failed to load listing health data");
    } finally {
      if (cancelled || !mountedRef.current) return;
      setIsLoading(false);
    }
    cancelled = true;
  }, [enabled, page, limit, filters]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchAll();
    if (refreshIntervalMs && refreshIntervalMs > 0) {
      intervalRef.current = setInterval(() => void fetchAll(), refreshIntervalMs);
    }
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll, refreshIntervalMs]);

  const setPage = useCallback((nextPage: number) => {
    setPageState(Math.max(1, nextPage));
  }, []);

  const setLimit = useCallback((nextLimit: number) => {
    setLimitState(Math.max(1, Math.min(100, nextLimit)));
    setPageState(1);
  }, []);

  const setFilters = useCallback((nextFilters: Partial<ListingHealthFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...nextFilters }));
    setPageState(1);
  }, []);

  return {
    summary,
    alerts,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    error,
    refetch: fetchAll,
    setPage,
    setLimit,
    setFilters,
  };
}
