import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAuthResponse } from "../../lib/api-client";
import {
  isLoginResponse,
  isRefreshSessionResponse,
  isRegisterResponse,
} from "../../types/api";

// Java shapes (the only backend now): session nested under `data`,
// no email on the user, no message/user on refresh.
const javaLogin = {
  success: true,
  message: null,
  data: {
    user: { id: "user-1", username: "shathwik" },
    accessToken: "access-token",
  },
  errors: null,
};

const javaRegister = {
  success: true,
  message: "created",
  data: {
    user: { id: "user-1", username: "shathwik" },
    accessToken: "access-token",
  },
};

const javaRefresh = {
  success: true,
  message: null,
  data: { accessToken: "new-access-token" },
  errors: null,
};

test("login normalizer lifts the Java session into the flat contract", () => {
  const payload = normalizeAuthResponse("/api/auth/login", javaLogin);
  assert.equal(isLoginResponse(payload), true);
  if (isLoginResponse(payload)) {
    assert.equal(payload.user.username, "shathwik");
    assert.equal(payload.accessToken, "access-token");
    assert.equal(payload.message, "Signed in successfully.");
  }
});

test("register guard accepts the Java session shape", () => {
  assert.equal(isRegisterResponse(javaRegister), true);
});

test("refresh normalizer keeps the stored user when Java omits it", () => {
  const payload = normalizeAuthResponse("/api/auth/refresh", javaRefresh);
  // No stored session in this runner, so the guard must reject rather
  // than fabricate a user — the app then forces a fresh login.
  assert.equal(isRefreshSessionResponse(payload), false);
});

test("normalizer leaves non-auth envelopes untouched", () => {
  const envelope = { success: true, data: { rows: [] } };
  assert.equal(normalizeAuthResponse("/api/market/live", envelope), envelope);
});

test("normalizer leaves failures untouched", () => {
  const failure = { success: false, message: "Invalid credentials" };
  assert.equal(
    normalizeAuthResponse("/api/auth/login", failure),
    failure,
  );
  assert.equal(isLoginResponse(failure), false);
});
