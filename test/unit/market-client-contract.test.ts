import assert from "node:assert/strict";
import test from "node:test";

import {
  getMarketApiErrorMessage,
  isMarketColumnValuesResponse,
  isMarketFilterOptions,
  isMarketLiveResponse,
} from "../../lib/market/client-contract";

function createLiveMarketResponse(): unknown {
  return {
    stocks: [
      {
        id: "1",
        securityId: 101,
        exchange: "NSE",
        exchangeSegment: "NSE_EQ",
        companyName: "Alpha Industries",
        tradingSymbol: "ALPHA",
        sector: "Industrials",
        industry: "Manufacturing",
        group: "EQ",
        faceValue: 10,
        priceBand: "10%",
        marketCap: "₹250 Cr",
        preClose: 100,
        cmp: 102.5,
        netChange: 2.5,
        percentChange: 2.5,
        percentChanges: { "% Chag": 2.5 },
        week52High: 120,
        week52Low: 80,
        volume: 10_000,
      },
    ],
    pagination: { page: 1, pageSize: 200, totalStocks: 1, totalPages: 1 },
    stats: {
      totalGainers: 1,
      totalLosers: 0,
      totalUnchanged: 0,
      avgGain: 2.5,
      avgLoss: 0,
      topGainer: {
        company: "Alpha Industries",
        symbol: "ALPHA",
        sector: "Industrials",
        ltp: 102.5,
        percentInChange: 2.5,
      },
      topLoser: null,
    },
    filteredCounts: {
      total: 1,
      gainers: 1,
      losers: 0,
      unchanged: 0,
      highHits: 0,
      lowHits: 0,
    },
    lastSyncAt: "2026-07-26T09:15:00.000Z",
    syncStatus: {
      isRunning: false,
      historicalPopulating: true,
      historicalProgress: { completed: 10, total: 100 },
      cachedCount: 25,
    },
  };
}

test("isMarketLiveResponse accepts the complete public market response contract", () => {
  assert.equal(isMarketLiveResponse(createLiveMarketResponse()), true);
});

test("isMarketLiveResponse rejects malformed data before the UI can consume it", () => {
  const malformedResponse = createLiveMarketResponse() as {
    readonly stocks: Array<Record<string, unknown>>;
  };
  malformedResponse.stocks[0] = {
    ...malformedResponse.stocks[0],
    cmp: "not-a-number",
  };

  assert.equal(isMarketLiveResponse(malformedResponse), false);
});

test("isMarketFilterOptions only accepts arrays of visible string filters", () => {
  assert.equal(
    isMarketFilterOptions({
      sectors: ["Banking"],
      industries: ["Private Banks"],
      marketCaps: ["Large Cap"],
      priceBands: ["10%"],
      series: ["EQ"],
    }),
    true,
  );
  assert.equal(
    isMarketFilterOptions({
      sectors: ["Banking"],
      industries: ["Private Banks"],
      marketCaps: ["Large Cap"],
      priceBands: ["10%"],
      series: [123],
    }),
    false,
  );
});

test("isMarketColumnValuesResponse refuses blank or unknown added-column states", () => {
  assert.equal(
    isMarketColumnValuesResponse({
      columnCount: 1,
      values: {
        "NSE_EQ:101": {
          "tf-1day:indicators:sma-5": {
            state: "ready",
            display: "102.50",
            numericValue: 102.5,
          },
        },
      },
    }),
    true,
  );
  assert.equal(
    isMarketColumnValuesResponse({
      columnCount: 1,
      values: {
        "NSE_EQ:101": {
          "tf-5min:indicators:sma-5": {
            state: "warming-intraday",
            display: "Collecting",
          },
        },
      },
    }),
    true,
  );
  assert.equal(
    isMarketColumnValuesResponse({
      columnCount: 1,
      values: {
        "NSE_EQ:101": {
          broken: { state: "ready", display: "" },
        },
      },
    }),
    false,
  );
});

test("getMarketApiErrorMessage supports the current and legacy safe error envelopes", () => {
  assert.equal(
    getMarketApiErrorMessage(
      { success: false, message: "Invalid market query parameters" },
      "Fallback",
    ),
    "Invalid market query parameters",
  );
  assert.equal(
    getMarketApiErrorMessage({ error: "Legacy endpoint error" }, "Fallback"),
    "Legacy endpoint error",
  );
  assert.equal(
    getMarketApiErrorMessage({ message: "" }, "Fallback"),
    "Fallback",
  );
});
