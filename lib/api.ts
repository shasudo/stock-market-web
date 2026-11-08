import { ApiEnvelope, ApiError } from "./types";

const BASE = "/api/backend/v1";

let authToken: string | null = null;

/** Called by the session layer after login/refresh; cleared on logout. */
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(authToken != null ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(res.status, `Request failed (${res.status}).`);
  }
  if (!res.ok || envelope.success === false) {
    throw new ApiError(
      res.status,
      envelope.message || `Request failed (${res.status}).`,
      null,
      envelope.errors ?? null,
    );
  }
  // data:null is a valid empty answer, not an error.
  return envelope.data as T;
}

/** Typed client for the Java backend. Same-origin via Next rewrites, so the
 *  browser never touches CORS. Every payload arrives in the ApiResponse
 *  envelope; data:null (not a throw) is how the backend says "nothing". */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

/** DELETE with a JSON body — the backend deletes alerts/watchlist rows by id payload. */
export function apiDelete<T>(path: string, body: unknown): Promise<T> {
  return request<T>("DELETE", path, body);
}

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}
