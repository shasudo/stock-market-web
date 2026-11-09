import assert from "node:assert/strict";
import test from "node:test";

import { isMarketLiveResponse } from "../../lib/market/client-contract";

// The Java /api/v1/market/live shape: absent optionals arrive as explicit
// null (the retired backend omitted the key). The page must accept both,
// otherwise an empty-but-valid market snapshot shows "invalid response".
function javaLivePayload() {
  return {
    stocks: [],
    pagination: { page: 1, pageSize: 2, totalStocks: 0, totalPages: 0 },
    stats: {
      totalGainers: 0,
      totalLosers: 0,
      totalUnchanged: 0,
      avgGain: 0.0,
      avgLoss: 0.0,
      lastSyncAt: null,
      topGainer: null,
      topLoser: null,
    },
    filteredCounts: {
      total: 0,
      gainers: 0,
      losers: 0,
      unchanged: 0,
      highHits: 0,
      lowHits: 0,
    },
    lastSyncAt: null,
    syncStatus: {
      isRunning: false,
      historicalPopulating: false,
      historicalProgress: { completed: 0, total: 0 },
      cachedCount: 0,
    },
    filteredCountsStale: false,
    technicals: null,
    patternSummary: null,
  };
}

test("live guard accepts Java nulls for absent optionals", () => {
  assert.equal(isMarketLiveResponse(javaLivePayload()), true);
});

test("live guard still accepts the payload with keys omitted", () => {
  const payload = javaLivePayload() as Record<string, unknown>;
  delete payload.patternSummary;
  delete payload.technicals;
  assert.equal(isMarketLiveResponse(payload), true);
});

test("live guard still rejects malformed snapshots", () => {
  assert.equal(isMarketLiveResponse({ stocks: "nope" }), false);
  assert.equal(isMarketLiveResponse(null), false);
  const badStats = javaLivePayload() as Record<string, unknown>;
  (badStats.stats as Record<string, unknown>).totalGainers = "0";
  assert.equal(isMarketLiveResponse(badStats), false);
});
