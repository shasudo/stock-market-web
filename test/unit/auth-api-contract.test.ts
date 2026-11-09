import assert from "node:assert/strict";
import test from "node:test";

import {
  isLoginResponse,
  isRefreshSessionResponse,
  isRegisterResponse,
} from "../../types/api";

const authenticatedUser = {
  id: "user-1",
  username: "market-user",
  email: "market-user@example.com",
};

test("authentication response guards accept valid server contracts", () => {
  assert.equal(
    isLoginResponse({
      success: true,
      message: "Login successful",
      accessToken: "access-token",
      user: authenticatedUser,
    }),
    true,
  );
  assert.equal(
    isRefreshSessionResponse({
      success: true,
      accessToken: "access-token",
      user: authenticatedUser,
    }),
    true,
  );
  assert.equal(
    isRegisterResponse({
      success: true,
      message: "User registered successfully",
      data: authenticatedUser,
    }),
    true,
  );
});

test("authentication response guards reject malformed token and user payloads", () => {
  assert.equal(
    isLoginResponse({
      success: true,
      message: "Login successful",
      accessToken: "",
      user: authenticatedUser,
    }),
    false,
  );
  assert.equal(
    isRefreshSessionResponse({
      success: true,
      accessToken: "access-token",
      user: { ...authenticatedUser, email: 42 },
    }),
    false,
  );
  assert.equal(
    isRegisterResponse({
      success: true,
      data: { id: "user-1", username: "market-user" },
    }),
    false,
  );
});
