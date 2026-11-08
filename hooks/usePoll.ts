"use client";

import { useEffect, useState } from "react";

/** Poll a fetcher on an interval; exposes age + staleness for the top strip.
 *  Errors are swallowed into `stale` — panels render their own empty states. */
export function usePoll<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
): { data: T | null; ageMs: number | null; stale: boolean; failed: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    async function tick() {
      try {
        const value = await fetcher();
        if (!live) return;
        setData(value);
        setAt(Date.now());
        setStale(false);
        setFailed(false);
      } catch {
        if (!live) return;
        setStale(true);
        setFailed(true);
      }
    }
    void tick();
    timer = setInterval(() => {
      setNow(Date.now());
      void tick();
    }, intervalMs);
    return () => {
      live = false;
      if (timer !== undefined) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { data, ageMs: at == null ? null : Math.max(0, now - at), stale, failed };
}

/** IST wall clock, ticking once a second for the market strip. */
export function useIstClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
