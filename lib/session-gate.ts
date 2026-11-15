const textEncoder = new TextEncoder();

export const SESSION_COOKIE_NAME = "smp-session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const DEV_ONLY_SECRET = "dev-only-insecure-session-secret";

let warnedAboutDevSecret = false;

export function getSessionSecret(): string | undefined {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length > 0) {
    return configured;
  }
  if (process.env.NODE_ENV !== "production") {
    if (!warnedAboutDevSecret) {
      warnedAboutDevSecret = true;
      console.warn(
        "[session] SESSION_SECRET is not set; using an insecure dev-only secret.",
      );
    }
    return DEV_ONLY_SECRET;
  }
  return undefined;
}

export function sessionCookieOptions(): {
  httpOnly: boolean;
  path: string;
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
} {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.COOKIE_SECURE !== "false",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded =
    value.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmacKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export async function sealSession(
  secret: string,
  nowMs: number = Date.now(),
): Promise<string> {
  const expiresAt = String(nowMs + SESSION_MAX_AGE_SECONDS * 1000);
  const key = await hmacKey(secret, "sign");
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textEncoder.encode(expiresAt)),
  );
  return `${expiresAt}.${base64UrlEncode(signature)}`;
}

export async function verifySession(
  token: string | undefined,
  secret: string | undefined,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!token || !secret) {
    return false;
  }
  const separator = token.indexOf(".");
  if (separator <= 0) {
    return false;
  }
  const expiresAt = Number(token.slice(0, separator));
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
    return false;
  }
  try {
    const key = await hmacKey(secret, "verify");
    const signature = new Uint8Array(base64UrlDecode(token.slice(separator + 1)));
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      textEncoder.encode(token.slice(0, separator)),
    );
  } catch {
    return false;
  }
}

export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isPublicPage(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/" || path === "/register";
}

export function isPublicApi(pathname: string): boolean {
  return pathname === "/api/auth" || pathname.startsWith("/api/auth/");
}

export type PageGateDecision = "allow" | "login" | "dashboard";

export function decidePageRequest(
  pathname: string,
  hasSession: boolean,
): PageGateDecision {
  if (isPublicPage(pathname)) {
    return hasSession ? "dashboard" : "allow";
  }
  return hasSession ? "allow" : "login";
}

export type ApiGateDecision = "allow" | "deny";

export function decideApiRequest(request: {
  hasSession: boolean;
  hasBearer: boolean;
}): ApiGateDecision {
  return request.hasSession || request.hasBearer ? "allow" : "deny";
}

type FetchImpl = (
  input: string,
  init?: { headers?: Record<string, string>; cache?: RequestCache },
) => Promise<{ status: number }>;

export async function verifyAccessToken(
  accessToken: string,
  fetchImpl: FetchImpl = fetch as unknown as FetchImpl,
): Promise<boolean> {
  if (accessToken === "") {
    return false;
  }
  const origin = process.env.API_ORIGIN ?? "https://129-225-78-203.nip.io";
  // Market and settings endpoints answer 200 without a token, so they prove
  // nothing. The watchlist is user-scoped: it 401s strangers and 200s owners.
  try {
    const response = await fetchImpl(`${origin}/api/v1/watchlist`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    return response.status !== 401 && response.status !== 403;
  } catch {
    return false;
  }
}
