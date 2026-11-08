import { ApiEnvelope, ApiError } from "./types";

const BASE = "/api/backend/v1";

/** Typed client for the Java backend. Same-origin via Next rewrites, so the
 *  browser never touches CORS. Every payload arrives in the ApiResponse
 *  envelope; data:null (not a throw) is how the backend says "nothing". */
export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(res.status, `Request failed (${res.status}).`);
  }
  if (!res.ok || envelope.success === false) {
    throw new ApiError(res.status, envelope.message || `Request failed (${res.status}).`);
  }
  // data:null is a valid empty answer, not an error.
  return envelope.data as T;
}

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}
