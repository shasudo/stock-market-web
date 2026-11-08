"use client";

import { apiGet, apiPost, setAuthToken } from "./api";
import { ApiError } from "./types";
import type { RefreshView, SessionView, UserView } from "./types";

const KEY = "smw-at";

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function store(token: string | null) {
  setAuthToken(token);
  try {
    if (token == null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, token);
  } catch {
    /* private mode — session-only */
  }
}

/** Pick up the persisted session after reload. Call once from signed-in pages. */
export function restoreSession() {
  setAuthToken(stored());
}

export function signedIn(): boolean {
  return stored() != null;
}

export async function login(username: string, password: string): Promise<UserView> {
  const session = await apiPost<SessionView>("/auth/login", { username, password });
  store(session.accessToken);
  return session.user;
}

export async function register(username: string, password: string): Promise<UserView> {
  const session = await apiPost<SessionView>("/auth/register", { username, password });
  store(session.accessToken);
  return session.user;
}

async function refresh(): Promise<boolean> {
  try {
    const session = await apiPost<RefreshView>("/auth/refresh", {});
    store(session.accessToken);
    return true;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiPost<unknown>("/auth/logout", {});
  } catch {
    /* logout is best-effort; the local token is dropped regardless */
  }
  store(null);
}

/** Current user, or null when signed out. One silent refresh is attempted on 401. */
export async function me(): Promise<UserView | null> {
  if (!signedIn()) return null;
  try {
    return await apiGet<UserView>("/auth/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && (await refresh())) {
      try {
        return await apiGet<UserView>("/auth/me");
      } catch {
        store(null);
        return null;
      }
    }
    return null;
  }
}
