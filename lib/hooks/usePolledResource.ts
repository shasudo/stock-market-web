"use client";

import { useEffect, useRef, useState } from "react";

export interface PolledResource<T> {
  readonly data: T | null;
  readonly error: unknown;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly updatedAt: number | null;
}

interface ResourceState<T> {
  readonly key: string | null;
  readonly data: T | null;
  readonly error: unknown;
  readonly updatedAt: number | null;
  readonly polling: boolean;
}

/**
 * Fetches on mount / when `key` changes, then re-fetches every `intervalMs`
 * while the tab is visible (and right away when it becomes visible again).
 * The last good data stays on screen through a failed poll; a new `key`
 * never shows the previous key's rows.
 */
export function usePolledResource<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
): PolledResource<T> {
  const [state, setState] = useState<ResourceState<T>>({
    key: null,
    data: null,
    error: null,
    updatedAt: null,
    polling: false,
  });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    if (key === null) return undefined;
    const poll = () => {
      if (document.visibilityState === "visible") setTick((value) => value + 1);
    };
    const timer = window.setInterval(poll, intervalMs);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [key, intervalMs]);

  useEffect(() => {
    if (key === null) return undefined;
    const controller = new AbortController();

    const load = async (): Promise<void> => {
      setState((current) =>
        current.key === key ? { ...current, polling: true } : current,
      );
      try {
        const data = await fetcherRef.current(controller.signal);
        if (controller.signal.aborted) return;
        setState({
          key,
          data,
          error: null,
          updatedAt: Date.now(),
          polling: false,
        });
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        setState((current) =>
          current.key === key
            ? { ...current, error, polling: false }
            : { key, data: null, error, updatedAt: null, polling: false },
        );
      }
    };

    void load();
    return () => controller.abort();
  }, [key, tick]);

  const settled = state.key === key;
  return {
    data: settled ? state.data : null,
    error: settled ? state.error : null,
    loading:
      key !== null &&
      (!settled || (state.data === null && state.error === null)),
    refreshing: settled && state.polling,
    updatedAt: settled ? state.updatedAt : null,
  };
}
