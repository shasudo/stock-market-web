"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { me, restoreSession, signedIn } from "@/lib/auth";
import type { UserView } from "@/lib/types";

/** Terminal tabs under /stock/[symbol] need auth. Returns the session once,
 *  so every tab shares one gate instead of re-checking. */
export function useTerminalSession(): { user: UserView | null; checked: boolean } {
  const [user, setUser] = useState<UserView | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    restoreSession();
    if (!signedIn()) {
      setChecked(true);
      return;
    }
    let live = true;
    me().then((u) => {
      if (live) {
        setUser(u);
        setChecked(true);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  return { user, checked };
}

/** Authed poll: fetches only with a session, reports a gate otherwise. */
export function useTerminalData<T>(user: UserView | null, checked: boolean, path: string | null, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!checked || user == null || path == null) return;
    const url = path;
    let live = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    async function tick() {
      try {
        const value = await apiGet<T>(url);
        if (!live) return;
        setData(value);
        setFailed(false);
      } catch {
        if (live) setFailed(true);
      }
    }
    void tick();
    timer = setInterval(() => void tick(), intervalMs);
    return () => {
      live = false;
      if (timer !== undefined) clearInterval(timer);
    };
  }, [checked, user, path, intervalMs]);

  return { data, failed, loading: data == null && !failed, gated: checked && user == null };
}
