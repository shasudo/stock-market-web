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

test("page-level guards accept unwrapped Java envelopes", async () => {
  const { isMarketLiveResponse } = await import("../../lib/market/client-contract");
  const live = unwrapApiEnvelope({
    success: true,
    message: null,
    data: { stocks: [], pagination: { page: 1, pageSize: 2, totalStocks: 0, totalPages: 0 },
      stats: { totalGainers: 0, totalLosers: 0, totalUnchanged: 0, avgGain: 0, avgLoss: 0, lastSyncAt: null, topGainer: null, topLoser: null },
      filteredCounts: { total: 0, gainers: 0, losers: 0, unchanged: 0, highHits: 0, lowHits: 0 },
      lastSyncAt: null,
      syncStatus: { isRunning: false, historicalPopulating: false, historicalProgress: { completed: 0, total: 0 }, cachedCount: 0 },
      patternSummary: null },
    errors: null,
  });
  assert.equal(isMarketLiveResponse(live), true);
});

test("isApiEnvelope only matches envelope-shaped values", () => {
  assert.equal(isApiEnvelope({ success: true, data: {} }), true);
  assert.equal(isApiEnvelope({ stocks: [] }), false);
  assert.equal(isApiEnvelope(null), false);
});
