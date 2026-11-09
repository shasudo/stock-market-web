import type { NextResponse } from "next/server";

const SECONDS_PER_DAY = 24 * 60 * 60;

export const REFRESH_TOKEN_COOKIE_NAME = "stock-market-app.refresh-token";
export const REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS = 30 * SECONDS_PER_DAY;

export const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
  priority: "high" as const,
} as const;

export function clearRefreshTokenCookie<T>(
  response: NextResponse<T>,
): NextResponse<T> {
  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE_NAME,
    value: "",
    ...REFRESH_TOKEN_COOKIE_OPTIONS,
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
