import assert from "node:assert/strict";
import test from "node:test";

import {
  decideApiRequest,
  decidePageRequest,
  isPublicApi,
  isPublicPage,
  sealSession,
  verifyAccessToken,
  verifySession,
} from "../../lib/session-gate";

test("isPublicPage only allows the sign-in and registration pages", () => {
  assert.equal(isPublicPage("/"), true);
  assert.equal(isPublicPage("/register"), true);
  assert.equal(isPublicPage("/register/"), true);
  assert.equal(isPublicPage("/dashboard"), false);
  assert.equal(isPublicPage("/login"), false);
  assert.equal(isPublicPage("/watchlist"), false);
  assert.equal(isPublicPage("/api/watchlist"), false);
});

test("isPublicApi only allows the auth exchange endpoints", () => {
  assert.equal(isPublicApi("/api/auth/login"), true);
  assert.equal(isPublicApi("/api/auth/register"), true);
  assert.equal(isPublicApi("/api/auth/refresh"), true);
  assert.equal(isPublicApi("/api/auth/logout"), true);
  assert.equal(isPublicApi("/api/watchlist"), false);
  assert.equal(isPublicApi("/api/market/live"), false);
  assert.equal(isPublicApi("/api/stocks/stats"), false);
});

test("decidePageRequest sends strangers to sign-in and members to the dashboard", () => {
  assert.equal(decidePageRequest("/dashboard", false), "login");
  assert.equal(decidePageRequest("/watchlist/deep", false), "login");
  assert.equal(decidePageRequest("/api/watchlist", false), "login");
  assert.equal(decidePageRequest("/dashboard", true), "allow");
  assert.equal(decidePageRequest("/", false), "allow");
  assert.equal(decidePageRequest("/register", false), "allow");
  assert.equal(decidePageRequest("/", true), "dashboard");
  assert.equal(decidePageRequest("/register", true), "dashboard");
});

test("decideApiRequest needs a session cookie or a bearer token", () => {
  assert.equal(
    decideApiRequest({ hasSession: false, hasBearer: false }),
    "deny",
  );
  assert.equal(decideApiRequest({ hasSession: true, hasBearer: false }), "allow");
  assert.equal(decideApiRequest({ hasSession: false, hasBearer: true }), "allow");
  assert.equal(decideApiRequest({ hasSession: true, hasBearer: true }), "allow");
});

test("sealed sessions verify and tampered or expired ones do not", async () => {
  const secret = "test-secret";
  const sealed = await sealSession(secret);
  assert.equal(await verifySession(sealed, secret), true);
  assert.equal(await verifySession(sealed, "wrong-secret"), false);
  assert.equal(await verifySession(undefined, secret), false);
  assert.equal(await verifySession(sealed, undefined), false);
  assert.equal(await verifySession("not-a-session", secret), false);
  assert.equal(await verifySession(`${sealed}tampered`, secret), false);

  const [expiresAt, signature] = sealed.split(".");
  assert.equal(
    await verifySession(`9${expiresAt.slice(1)}.${signature}`, secret),
    false,
  );

  const expired = await sealSession(secret, Date.now() - 31 * 24 * 60 * 60 * 1000);
  assert.equal(await verifySession(expired, secret), false);
});

test("verifyAccessToken trusts every answer except denied or missing", async () => {
  const ok = (status: number) => async () =>
    new Response(null, { status }) as unknown as Response;
  assert.equal(await verifyAccessToken("token", ok(200)), true);
  assert.equal(await verifyAccessToken("token", ok(404)), true);
  assert.equal(await verifyAccessToken("token", ok(401)), false);
  assert.equal(await verifyAccessToken("token", ok(403)), false);
  assert.equal(
    await verifyAccessToken("token", async () => {
      throw new Error("down");
    }),
    false,
  );
  assert.equal(await verifyAccessToken("", ok(200)), false);
});
