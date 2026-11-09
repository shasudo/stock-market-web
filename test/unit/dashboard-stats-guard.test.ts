import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractDashboardStats,
  isDashboardStatsResponse,
} from "../../lib/dashboard/stats-guard";

// Java GET /api/v1/stocks/stats shape (live probe 2026-11-09):
// {success, message, data:{stats:{...}}, errors}
const javaEnvelope = {
  success: true,
  message: null,
  data: {
    stats: {
      totalGainers: 1074,
      totalLosers: 1929,
      totalUnchanged: 69,
      avgGain: 2.17,
      avgLoss: -2.36,
      lastSyncAt: "2026-11-07T14:12:48.536Z",
      topGainer: {
        company: "MM Forgings",
        symbol: "MMFL",
        sector: "Ferrous Metals",
        ltp: 629.4,
        percentInChange: 19.95,
      },
      topLoser: {
        company: "Knowledge Marine & Engineering Works",
        symbol: "KMEW",
        sector: "Construction",
        ltp: 652.8,
        percentInChange: -79.23,
      },
    },
  },
  errors: null,
};

describe("dashboard stats guard (Java envelope)", () => {
  it("accepts the live Java envelope via unwrap", () => {
    assert.equal(isDashboardStatsResponse(javaEnvelope), true);
  });

  it("extract returns the nested stats object itself", () => {
    const stats = extractDashboardStats(javaEnvelope);
    assert.notEqual(stats, null);
    assert.equal(stats?.totalGainers, 1074);
    assert.equal(stats?.totalLosers, 1929);
    assert.equal(stats?.topGainer?.company, "MM Forgings");
    assert.equal(extractDashboardStats({ success: false }), null);
    assert.equal(extractDashboardStats(null), null);
  });

  it("rejects failure envelopes and bare junk", () => {
    assert.equal(
      isDashboardStatsResponse({ success: false, data: null }),
      false,
    );
    assert.equal(isDashboardStatsResponse(null), false);
    assert.equal(isDashboardStatsResponse({ stats: null }), false);
    assert.equal(
      isDashboardStatsResponse({ data: { stats: { totalGainers: "lots" } } }),
      false,
    );
  });

  it("accepts null top movers (empty market)", () => {
    const empty = {
      success: true,
      message: null,
      data: {
        stats: {
          totalGainers: 0,
          totalLosers: 0,
          avgGain: 0,
          avgLoss: 0,
          lastSyncAt: null,
          topGainer: null,
          topLoser: null,
        },
      },
      errors: null,
    };
    assert.equal(isDashboardStatsResponse(empty), true);
  });
});
