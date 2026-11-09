export interface ConstituentMetric {
  readonly symbol: string;
  readonly trailingPe: number | undefined;
  readonly marketCapitalization: number | undefined;
  readonly sharesOutstanding?: number | undefined;
  readonly sharesFloat?: number | undefined;
}

export interface AggregateIndexPe {
  readonly pe: number;
  readonly constituentCount: number;
}

/**
 * Free-float weight for one constituent. NSE weights index valuation ratios
 * by free-float market capitalization, so the float share scales the
 * provider's (full) market cap. Constituents without usable float data fall
 * back to full market cap rather than being dropped.
 */
function constituentWeight(metric: ConstituentMetric): number | undefined {
  const marketCap = metric.marketCapitalization;
  if (
    marketCap === undefined ||
    !Number.isFinite(marketCap) ||
    marketCap <= 0
  ) {
    return undefined;
  }
  const outstanding = metric.sharesOutstanding;
  const floating = metric.sharesFloat;
  if (
    outstanding !== undefined &&
    floating !== undefined &&
    Number.isFinite(outstanding) &&
    Number.isFinite(floating) &&
    outstanding > 0 &&
    floating > 0 &&
    floating <= outstanding
  ) {
    return (marketCap * floating) / outstanding;
  }
  return marketCap;
}

/**
 * Aggregate index P/E — total free-float market cap over total earnings,
 * where each constituent's earnings are its free-float weight divided by
 * its trailing P/E. This is NSE's own methodology for the published Nifty
 * P/E (consolidated trailing twelve months).
 *
 * A market-cap-weighted average of ratios was used before 06 Nov 2026 and
 * was replaced because it is a biased estimator: by Jensen's inequality it
 * always reads high whenever constituent P/Es disperse (ours printed ~40
 * against NSE's ~20). Full-cap weighting then still read high (~21.6 vs
 * NSE's 20.65 on 06 Nov 2026), so weights moved to free float. Constituents
 * missing PE or market cap, or with a negative/zero PE (loss-making — NSE
 * excludes these too), are skipped rather than defaulted to a fake value.
 */
export function computeAggregateIndexPe(
  metrics: readonly ConstituentMetric[],
): AggregateIndexPe | null {
  let totalWeight = 0;
  let totalEarnings = 0;
  let constituentCount = 0;

  for (const metric of metrics) {
    const pe = metric.trailingPe;
    if (pe === undefined || !Number.isFinite(pe) || pe <= 0) {
      continue;
    }
    const weight = constituentWeight(metric);
    if (weight === undefined) {
      continue;
    }

    totalWeight += weight;
    totalEarnings += weight / pe;
    constituentCount += 1;
  }

  if (totalEarnings <= 0 || constituentCount === 0) return null;

  return {
    pe: Math.round((totalWeight / totalEarnings) * 100) / 100,
    constituentCount,
  };
}
