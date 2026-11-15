import { NextResponse } from "next/server";
import {
  getSessionSecret,
  sealSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyAccessToken,
} from "@/lib/session-gate";

function sessionFailure(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}

function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    ...sessionCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}

export async function POST(request: Request) {
  const secret = getSessionSecret();
  if (!secret) {
    return sessionFailure("Session support is not configured.", 503);
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const accessToken =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).accessToken
      : undefined;
  if (typeof accessToken !== "string" || accessToken === "") {
    return sessionFailure("A valid access token is required.", 400);
  }

  const tokenValid = await verifyAccessToken(accessToken);
  if (!tokenValid) {
    return sessionFailure("The session could not be verified.", 401);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: await sealSession(secret),
    ...sessionCookieOptions(),
  });
  return response;
}

export async function DELETE() {
  return clearSessionCookie(NextResponse.json({ success: true }));
}
