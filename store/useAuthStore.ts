import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { isRefreshSessionResponse, type AuthenticatedUser } from "@/types/api";

interface AuthState {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthenticatedUser, accessToken: string) => void;
  logout: () => void;
}

function clearRefreshSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  void window
    .fetch("/api/auth/logout", {
      credentials: "include",
      keepalive: true,
      method: "POST",
    })
    .catch(() => undefined);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        set({
          user,
          accessToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        });
        clearRefreshSession();
      },
    }),
    {
      name: "stock-market-app.auth-session",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : sessionStorage)),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

export function useHasHydrated(): boolean {
  const [hasResolvedSession, setHasResolvedSession] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    async function verifyAndRestoreSession(): Promise<void> {
      try {
        const response = await window.fetch("/api/auth/refresh", {
          credentials: "include",
          method: "POST",
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) {
          return;
        }

        if (response.ok) {
          const payload: unknown = await response.json();
          if (isRefreshSessionResponse(payload)) {
            useAuthStore.getState().setAuth(payload.user, payload.accessToken);
          }
        } else if (response.status === 401) {
          // If the server explicitly rejected the refresh token, clear stale local state
          const currentAuth = useAuthStore.getState();
          if (currentAuth.isAuthenticated) {
            useAuthStore.getState().logout();
          }
        }
      } catch {
        // Network/offline errors keep the local cache active
      } finally {
        if (!abortController.signal.aborted) {
          setHasResolvedSession(true);
        }
      }
    }

    void verifyAndRestoreSession();
    return () => {
      abortController.abort();
    };
  }, []);

  return hasResolvedSession;
}
