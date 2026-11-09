import { useEffect, useRef, useState, useCallback } from "react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/store/useAuthStore";

interface PersistedSettingsOptions<T> {
  scope: string;
  defaultSettings: T;
  normalize?: (raw: unknown) => T;
  debounceMs?: number;
}

export function usePersistedSettings<T extends object>({
  scope,
  defaultSettings,
  normalize = (raw) => (raw && typeof raw === "object" ? ({ ...defaultSettings, ...raw } as T) : defaultSettings),
  debounceMs = 600,
}: PersistedSettingsOptions<T>) {
  const storageKey = `stock-market-app.settings.${scope}`;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  // Initialize with normalized default settings to prevent hydration mismatches
  const [settings, setSettingsState] = useState<T>(() => normalize(defaultSettings));
  const [isLoaded, setIsLoaded] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestSettingsRef = useRef<T>(settings);
  latestSettingsRef.current = settings;

  // 1. Rehydrate from localStorage on client mount (safe after hydration)
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const normalized = normalize(parsed);
          setSettingsState(normalized);
          latestSettingsRef.current = normalized;
        }
      }
    } catch {
      // Ignore cache parsing errors
    }
  }, [storageKey, normalize]);

  // 2. Fetch remote settings from database when authenticated
  useEffect(() => {
    let isCancelled = false;

    async function loadRemoteSettings() {
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: { settings: unknown | null };
        }>(`/api/user/settings?scope=${encodeURIComponent(scope)}`);

        if (isCancelled) return;

        const remote = response.data?.data?.settings;
        if (remote && typeof remote === "object" && Object.keys(remote).length > 0) {
          const normalized = normalize(remote);
          setSettingsState(normalized);
          latestSettingsRef.current = normalized;
          try {
            localStorage.setItem(storageKey, JSON.stringify(normalized));
          } catch {}
        }
      } catch {
        // Fallback to local settings silently
      } finally {
        if (!isCancelled) {
          setIsLoaded(true);
        }
      }
    }

    if (isAuthenticated && user) {
      void loadRemoteSettings();
    } else {
      setIsLoaded(true);
    }

    return () => {
      isCancelled = true;
    };
  }, [scope, storageKey, isAuthenticated, user?.id, normalize]);

  // 3. Debounced save to remote database + instant local save
  const updateSettings = useCallback(
    (updater: Partial<T> | ((prev: T) => T)) => {
      setSettingsState((prev) => {
        const nextRaw =
          typeof updater === "function"
            ? (updater as (prev: T) => T)(prev)
            : { ...prev, ...updater };
        const next = normalize(nextRaw);
        latestSettingsRef.current = next;

        // Instant local cache
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(storageKey, JSON.stringify(next));
          }
        } catch {}

        // Debounced remote sync to PostgreSQL if logged in
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
          if (useAuthStore.getState().isAuthenticated) {
            try {
              await apiClient.put("/api/user/settings", {
                scope,
                settings: latestSettingsRef.current,
              });
            } catch {
              // Silently retry on next change
            }
          }
        }, debounceMs);

        return next;
      });
    },
    [scope, storageKey, debounceMs, normalize],
  );

  const resetSettings = useCallback(() => {
    const next = normalize(defaultSettings);
    setSettingsState(next);
    latestSettingsRef.current = next;

    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(storageKey);
      }
    } catch {}

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (useAuthStore.getState().isAuthenticated) {
      void apiClient
        .put("/api/user/settings", {
          scope,
          settings: next,
        })
        .catch(() => undefined);
    }
  }, [scope, storageKey, defaultSettings, normalize]);

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoaded,
  };
}
