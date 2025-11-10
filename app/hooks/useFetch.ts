import { useState, useEffect, useCallback, useRef } from "react";

interface UseFetchOptions {
  immediate?: boolean;
  cache?: boolean;
  cacheKey?: string;
}

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useFetch<T>(
  url: string | null,
  options: UseFetchOptions = {}
): UseFetchResult<T> {
  const { immediate = true, cache: useCache = true, cacheKey } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;

    // Check cache first
    const key = cacheKey || url;
    if (useCache && cache.has(key)) {
      const cached = cache.get(key)!;
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        setData(cached.data);
        setLoading(false);
        setError(null);
        return;
      }
      cache.delete(key);
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Cache the result
      if (useCache) {
        cache.set(key, { data: result, timestamp: Date.now() });
      }

      setData(result);
    } catch (err: any) {
      if (err.name === "AbortError") {
        return;
      }
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [url, useCache, cacheKey]);

  useEffect(() => {
    if (immediate) {
      fetchData();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData, immediate]);

  return { data, loading, error, refetch: fetchData };
}

