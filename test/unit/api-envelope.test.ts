import assert from "node:assert/strict";
import test from "node:test";

import { isApiEnvelope, unwrapApiEnvelope } from "../../lib/api-envelope";

test("unwrap passes Java success envelopes through to their data", () => {
  const data = { stocks: [], pagination: { page: 1 } };
  assert.equal(
    unwrapApiEnvelope({ success: true, message: null, data, errors: null }),
    data,
  );
});

test("unwrap leaves failure envelopes untouched for error handling", () => {
  const failure = { success: false, message: "Invalid market query parameters" };
  assert.equal(unwrapApiEnvelope(failure), failure);
});

test("unwrap leaves bare payloads untouched for legacy callers", () => {
  const bare = { stocks: [] };
  assert.equal(unwrapApiEnvelope(bare), bare);
  assert.equal(unwrapApiEnvelope(null), null);
  assert.equal(unwrapApiEnvelope(undefined), undefined);
});

test("isApiEnvelope only matches envelope-shaped values", () => {
  assert.equal(isApiEnvelope({ success: true, data: {} }), true);
  assert.equal(isApiEnvelope({ stocks: [] }), false);
  assert.equal(isApiEnvelope(null), false);
});
