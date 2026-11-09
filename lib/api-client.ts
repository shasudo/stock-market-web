import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/useAuthStore";
import {
  isRefreshSessionResponse,
  type ApiSuccessResponse,
  type RefreshSessionResponse,
} from "@/types/api";

export type { ApiSuccessResponse } from "@/types/api";

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface PendingRequest {
  resolve: (accessToken: string) => void;
  reject: (reason: unknown) => void;
}

const REFRESH_ENDPOINT = "/api/auth/refresh";
const apiClient = axios.create({ withCredentials: true });

let isRefreshing = false;
let pendingRequests: PendingRequest[] = [];

function setAuthorizationHeader(
  request: InternalAxiosRequestConfig,
  accessToken: string,
): void {
  request.headers.set("Authorization", `Bearer ${accessToken}`);
}

function resolvePendingRequests(accessToken: string): void {
  for (const pendingRequest of pendingRequests) {
    pendingRequest.resolve(accessToken);
  }
  pendingRequests = [];
}

function rejectPendingRequests(reason: unknown): void {
  for (const pendingRequest of pendingRequests) {
    pendingRequest.reject(reason);
  }
  pendingRequests = [];
}

function isRefreshRequest(url: string | undefined): boolean {
  return url?.includes(REFRESH_ENDPOINT) ?? false;
}

function getRetriableRequestConfig(
  error: AxiosError,
): RetriableRequestConfig | undefined {
  return error.config;
}

/**
 * Java auth parity adapter. The old backend returned flat auth payloads
 * ({success, message, accessToken, user}); Java nests the session under
 * `data` and omits email/message/user-on-refresh. This lifts the Java shape
 * into the flat shape every consumer already expects. Scoped to auth only —
 * every other envelope already matches.
 */
function normalizeAuthEnvelope(url: string | undefined, payload: unknown): unknown {
  if (url == null || !isRecord(payload) || payload.success !== true) {
    return payload;
  }
  const isAuthCall =
    url.includes("/api/auth/login") ||
    url.includes("/api/auth/register") ||
    url.includes("/api/auth/refresh");
  if (!isAuthCall || !isRecord(payload.data)) {
    return payload;
  }
  const data = payload.data as Record<string, unknown>;
  // Java refresh answers {accessToken} only; the stored user stays valid.
  const user =
    isRecord(data.user) && typeof data.user.id === "string"
      ? data.user
      : (useAuthStore.getState().user ?? null);
  const message =
    typeof payload.message === "string" && payload.message !== ""
      ? payload.message
      : "Signed in successfully.";
  return { success: true, message, accessToken: data.accessToken, user };
}

async function refreshSession(): Promise<RefreshSessionResponse> {
  const response = await axios.post<unknown>(REFRESH_ENDPOINT, undefined, {
    withCredentials: true,
  });

  const normalized = normalizeAuthEnvelope(REFRESH_ENDPOINT, response.data);
  if (!isRefreshSessionResponse(normalized)) {
    throw new Error(
      "The authentication service returned an invalid refresh response.",
    );
  }

  return normalized;
}

apiClient.interceptors.request.use((request) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    setAuthorizationHeader(request, accessToken);
  }
  return request;
});

apiClient.interceptors.response.use(
  (response) => {
    response.data = normalizeAuthEnvelope(response.config.url, response.data);
    return response;
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const originalRequest = getRetriableRequestConfig(error);
    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isRefreshRequest(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingRequests.push({ resolve, reject });
      }).then((accessToken) => {
        setAuthorizationHeader(originalRequest, accessToken);
        return apiClient(originalRequest);
      });
    }

    isRefreshing = true;

    try {
      const refreshedSession = await refreshSession();
      const { setAuth } = useAuthStore.getState();
      setAuth(refreshedSession.user, refreshedSession.accessToken);
      setAuthorizationHeader(originalRequest, refreshedSession.accessToken);
      resolvePendingRequests(refreshedSession.accessToken);

      return apiClient(originalRequest);
    } catch (refreshError: unknown) {
      rejectPendingRequests(refreshError);
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function isSuccessfulApiResponse(
  value: unknown,
): value is ApiSuccessResponse<unknown> {
  return isRecord(value) && value.success === true && "data" in value;
}

export function getApiResponseMessage(
  value: unknown,
  fallback: string,
): string {
  return isRecord(value) && typeof value.message === "string"
    ? value.message
    : fallback;
}

export function getAxiosErrorMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError<unknown>(error)
    ? getApiResponseMessage(error.response?.data, fallback)
    : fallback;
}
