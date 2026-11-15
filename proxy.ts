import { NextResponse, type NextRequest } from "next/server";
import {
  decideApiRequest,
  decidePageRequest,
  getSessionSecret,
  isPublicApi,
  SESSION_COOKIE_NAME,
  verifySession,
} from "@/lib/session-gate";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function isStaticAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) {
    return true;
  }
  const lastSegment = pathname.split("/").pop() ?? "";
  return lastSegment.includes(".");
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/session") {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasSession = await verifySession(sessionToken, getSessionSecret());

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }
    const decision = decideApiRequest({
      hasSession,
      hasBearer: request.headers.has("authorization"),
    });
    if (decision === "allow") {
      return NextResponse.next();
    }
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 },
    );
  }

  const decision = decidePageRequest(pathname, hasSession);
  if (decision === "allow") {
    return NextResponse.next();
  }
  const destination = request.nextUrl.clone();
  destination.pathname = decision === "dashboard" ? "/dashboard" : "/";
  destination.search = "";
  return NextResponse.redirect(destination);
}
