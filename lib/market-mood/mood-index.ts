/**
 * Market Mood Index: a 0 (extreme fear) .. 100 (extreme greed) composite of
 * live market factors. Pure: every input is passed in, so the scoring is unit
 * tested on its own. A factor whose input is missing is reported as
 * unavailable and left out of the average rather than counted as a neutral
 * 50, which would quietly drag the index toward the middle.
 */

export type MoodFactorKey =
  | "breadth"
  | "priceStrength"
  | "momentum"
  | "volatility"
  | "putCallRatio"
  | "fiiFlows";

export interface MoodFactorScore {
  readonly key: MoodFactorKey;
  readonly label: string;
  /** 0..100, or null when the input is unavailable. */
  readonly score: number | null;
  readonly rawValue: number | null;
  /** The raw reading in words, e.g. "India VIX at 17.47". */
  readonly detail: string;
  /** What the factor measures and which way it pushes the index. */
  readonly description: string;
}

export interface MoodIndexResult {
  /** 0..100, or null when no factor is available. */
  readonly score: number | null;
  readonly factors: readonly MoodFactorScore[];
}

export type MoodZoneKey =
  | "extremeFear"
  | "fear"
  | "neutral"
  | "greed"
  | "extremeGreed";

export interface MoodZone {
  readonly key: MoodZoneKey;
  readonly name: string;
  /** Inclusive lower bound. */
  readonly from: number;
  /** Exclusive upper bound (100 is inclusive for the last zone). */
  readonly to: number;
  readonly color: string;
  readonly description: string;
}

/** The one zone scale shared by the gauge, the headline and the zone list. */
export const MOOD_ZONES: readonly MoodZone[] = [
  {
    key: "extremeFear",
    name: "Extreme Fear",
    from: 0,
    to: 25,
    color: "#DC2626",
    description:
      "Selling pressure is broad and hedging is heavy. Historically, extreme fear has often come near short-term lows.",
  },
  {
    key: "fear",
    name: "Fear",
    from: 25,
    to: 45,
    color: "#F97316",
    description:
      "Sentiment is negative: more stocks are falling than rising and traders are cautious.",
  },
  {
    key: "neutral",
    name: "Neutral",
    from: 45,
    to: 55,
    color: "#EAB308",
    description: "Neither fear nor greed dominates; the market is balanced.",
  },
  {
    key: "greed",
    name: "Greed",
    from: 55,
    to: 75,
    color: "#84CC16",
    description:
      "Buyers are in control and risk appetite is rising; stay mindful of stretched valuations.",
  },
  {
    key: "extremeGreed",
    name: "Extreme Greed",
    from: 75,
    to: 100,
    color: "#16A34A",
    description:
      "Optimism is widespread and complacency is high. Historically, extreme greed has often preceded pullbacks.",
  },
];

export function moodZoneFor(score: number): MoodZone {
  const clamped = clamp(score, 0, 100);
  return (
    MOOD_ZONES.find((zone) => clamped >= zone.from && clamped < zone.to) ??
    MOOD_ZONES[MOOD_ZONES.length - 1]
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Linear map of `value` from [atZero, atHundred] onto 0..100, clamped. */
function linearScore(value: number, atZero: number, atHundred: number): number {
  return clamp(((value - atZero) / (atHundred - atZero)) * 100, 0, 100);
}

function unavailable(
  key: MoodFactorKey,
  label: string,
  detail: string,
  description: string,
): MoodFactorScore {
  return { key, label, score: null, rawValue: null, detail, description };
}

const BREADTH_DESCRIPTION =
  "Share of NSE + BSE stocks that rose today among those that moved. More advancers reads as greed.";

export function computeBreadthScore(
  gainers: number,
  losers: number,
): MoodFactorScore {
  const total = gainers + losers;
  if (total <= 0) {
    return unavailable(
      "breadth",
      "Market Breadth",
      "No advancing or declining stocks yet",
      BREADTH_DESCRIPTION,
    );
  }
  const share = gainers / total;
  return {
    key: "breadth",
    label: "Market Breadth",
    score: share * 100,
    rawValue: share,
    detail: `${gainers.toLocaleString("en-IN")} advancing vs ${losers.toLocaleString("en-IN")} declining`,
    description: BREADTH_DESCRIPTION,
  };
}

const PRICE_STRENGTH_DESCRIPTION =
  "Stocks trading within 2% of their 52-week high versus within 2% of their 52-week low. More new highs reads as greed.";

export function computePriceStrengthScore(
  nearHighs: number,
  nearLows: number,
): MoodFactorScore {
  const total = nearHighs + nearLows;
  if (total <= 0) {
    return unavailable(
      "priceStrength",
      "Price Strength",
      "No stocks near a 52-week high or low",
      PRICE_STRENGTH_DESCRIPTION,
    );
  }
  const share = nearHighs / total;
  return {
    key: "priceStrength",
    label: "Price Strength",
    score: share * 100,
    rawValue: share,
    detail: `${nearHighs.toLocaleString("en-IN")} near 52W high vs ${nearLows.toLocaleString("en-IN")} near 52W low`,
    description: PRICE_STRENGTH_DESCRIPTION,
  };
}

/** NIFTY this far above (below) its 50-day average saturates the score. */
const MOMENTUM_SATURATION_PCT = 5;
const MOMENTUM_DESCRIPTION =
  "NIFTY 50 against its 50-day average close. Trading well above the average reads as greed, well below as fear.";

export function computeMomentumScore(
  lastClose: number | null,
  movingAverage: number | null,
): MoodFactorScore {
  if (
    lastClose === null ||
    movingAverage === null ||
    !(lastClose > 0) ||
    !(movingAverage > 0)
  ) {
    return unavailable(
      "momentum",
      "NIFTY Momentum",
      "NIFTY price history unavailable",
      MOMENTUM_DESCRIPTION,
    );
  }
  const pctAbove = (lastClose / movingAverage - 1) * 100;
  return {
    key: "momentum",
    label: "NIFTY Momentum",
    score: linearScore(pctAbove, -MOMENTUM_SATURATION_PCT, MOMENTUM_SATURATION_PCT),
    rawValue: pctAbove,
    detail: `NIFTY ${pctAbove >= 0 ? "+" : ""}${pctAbove.toFixed(2)}% vs its 50-day average`,
    description: MOMENTUM_DESCRIPTION,
  };
}

const VIX_GREEDY_BOUND = 10;
const VIX_FEARFUL_BOUND = 30;
const VOLATILITY_DESCRIPTION =
  "India VIX, the market's expected 30-day volatility. A calm VIX near 10 reads as greed; a spike toward 30 reads as fear.";

export function computeVolatilityScore(
  vixValue: number | null,
): MoodFactorScore {
  if (vixValue === null || !(vixValue > 0)) {
    return unavailable(
      "volatility",
      "Volatility (India VIX)",
      "India VIX unavailable",
      VOLATILITY_DESCRIPTION,
    );
  }
  return {
    key: "volatility",
    label: "Volatility (India VIX)",
    score: linearScore(vixValue, VIX_FEARFUL_BOUND, VIX_GREEDY_BOUND),
    rawValue: vixValue,
    detail: `India VIX at ${vixValue.toFixed(2)}`,
    description: VOLATILITY_DESCRIPTION,
  };
}

/**
 * NIFTY options open interest is dominated by writers, so a high put/call OI
 * ratio means heavy put writing — traders expecting support — which Indian
 * markets read as bullish; a low ratio means call writing caps the upside.
 */
const PCR_FEARFUL_BOUND = 0.7;
const PCR_GREEDY_BOUND = 1.3;
const PCR_DESCRIPTION =
  "NIFTY nearest-expiry put open interest over call open interest. Heavy put writing (PCR above 1) signals expected support and reads as greed; below 0.7 reads as fear.";

export function computePutCallScore(
  callOpenInterest: number,
  putOpenInterest: number,
): MoodFactorScore {
  if (!(callOpenInterest > 0) || !(putOpenInterest >= 0)) {
    return unavailable(
      "putCallRatio",
      "Put/Call Ratio (NIFTY OI)",
      "NIFTY option open interest unavailable",
      PCR_DESCRIPTION,
    );
  }
  const ratio = putOpenInterest / callOpenInterest;
  return {
    key: "putCallRatio",
    label: "Put/Call Ratio (NIFTY OI)",
    score: linearScore(ratio, PCR_FEARFUL_BOUND, PCR_GREEDY_BOUND),
    rawValue: ratio,
    detail: `PCR ${ratio.toFixed(2)}`,
    description: PCR_DESCRIPTION,
  };
}

/** Average net FII cash flow per session (₹ crore) that saturates the score. */
const FII_SATURATION_CRORE = 3_000;
const FII_DESCRIPTION =
  "Average daily net cash-market buying by foreign institutional investors over the last 5 sessions. Net buying reads as greed, net selling as fear.";

export function computeFiiFlowScore(
  dailyNetCrore: readonly number[],
): MoodFactorScore {
  const flows = dailyNetCrore.filter((value) => Number.isFinite(value));
  if (flows.length === 0) {
    return unavailable(
      "fiiFlows",
      "FII Flows",
      "FII cash flows unavailable",
      FII_DESCRIPTION,
    );
  }
  const total = flows.reduce((sum, value) => sum + value, 0);
  const average = total / flows.length;
  const sessions = `${flows.length} session${flows.length === 1 ? "" : "s"}`;
  return {
    key: "fiiFlows",
    label: "FII Flows",
    score: linearScore(average, -FII_SATURATION_CRORE, FII_SATURATION_CRORE),
    rawValue: total,
    detail: `Net ${total >= 0 ? "buying" : "selling"} ₹${Math.abs(Math.round(total)).toLocaleString("en-IN")} Cr over ${sessions}`,
    description: FII_DESCRIPTION,
  };
}

export interface MoodInputs {
  readonly gainers: number;
  readonly losers: number;
  readonly nearHighs: number;
  readonly nearLows: number;
  readonly niftyClose: number | null;
  readonly niftyMovingAverage: number | null;
  readonly vix: number | null;
  readonly callOpenInterest: number;
  readonly putOpenInterest: number;
  /** Most recent first, ₹ crore. */
  readonly fiiDailyNet: readonly number[];
}

export function computeMoodIndex(inputs: MoodInputs): MoodIndexResult {
  const factors: readonly MoodFactorScore[] = [
    computeBreadthScore(inputs.gainers, inputs.losers),
    computePriceStrengthScore(inputs.nearHighs, inputs.nearLows),
    computeMomentumScore(inputs.niftyClose, inputs.niftyMovingAverage),
    computeVolatilityScore(inputs.vix),
    computePutCallScore(inputs.callOpenInterest, inputs.putOpenInterest),
    computeFiiFlowScore(inputs.fiiDailyNet),
  ];
  const available = factors
    .map((factor) => factor.score)
    .filter((score): score is number => score !== null);
  const score =
    available.length > 0
      ? available.reduce((sum, value) => sum + value, 0) / available.length
      : null;
  return { score, factors };
}

/** Simple average of the last `days` closes, or null with too few. */
export function trailingAverage(
  closes: readonly number[],
  days: number,
): number | null {
  const valid = closes.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length < days) return null;
  const window = valid.slice(-days);
  return window.reduce((sum, value) => sum + value, 0) / window.length;
}
