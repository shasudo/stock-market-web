/** Ready-made scans for the "Browse scans" library. */
import { parseMagicPrompt } from "./magic";
import { emptyGroup, newId, type Group, type Scan } from "./scan-types";

export interface ScanExample {
  readonly id: string;
  readonly name: string;
  readonly category: "Bullish" | "Bearish" | "Range & volatility" | "Volume" | "Patterns" | "Fundamental";
  readonly description: string;
  readonly prompt: string;
  readonly segment?: string;
}

export const SCAN_EXAMPLES: readonly ScanExample[] = [
  {
    id: "breakout-20d",
    name: "20 day breakout with volume",
    category: "Bullish",
    description: "Close above the prior 20-session high on twice the average volume.",
    prompt: "20 day high breakout and volume > 2 x sma(volume,20)",
  },
  {
    id: "golden-cross",
    name: "Golden cross",
    category: "Bullish",
    description: "50 SMA crossing above the 200 SMA today.",
    prompt: "golden cross",
  },
  {
    id: "ema-crossover",
    name: "EMA 9/21 bullish crossover",
    category: "Bullish",
    description: "Fast EMA crossing above slow EMA with price above the 50 EMA.",
    prompt: "ema 9 crossed above ema 21 and close above 50 ema",
  },
  {
    id: "supertrend-buy",
    name: "Supertrend buy",
    category: "Bullish",
    description: "Close crossed above Supertrend (7,3).",
    prompt: "supertrend crossed above",
  },
  {
    id: "macd-bull",
    name: "MACD bullish crossover",
    category: "Bullish",
    description: "MACD line crossing above its signal line.",
    prompt: "macd crossover",
  },
  {
    id: "rsi-momentum",
    name: "RSI momentum (weekly + daily)",
    category: "Bullish",
    description: "Weekly RSI above 60 and daily RSI crossing above 60.",
    prompt: "weekly rsi above 60 and rsi crossed above 60",
  },
  {
    id: "52w-high",
    name: "At 52 week high",
    category: "Bullish",
    description: "Today's high is the highest of the last 52 weeks.",
    prompt: "52 week high",
  },
  {
    id: "uptrend-sma50",
    name: "SMA50 rising for 20 days",
    category: "Bullish",
    description: "The 50-day SMA has risen every session for the last 20.",
    prompt: "sma50 in uptrend since last 20 days and close above sma 50",
  },
  {
    id: "breakdown-20d",
    name: "20 day breakdown",
    category: "Bearish",
    description: "Close below the prior 20-session low.",
    prompt: "20 day low breakdown",
  },
  {
    id: "death-cross",
    name: "Death cross",
    category: "Bearish",
    description: "50 SMA crossing below the 200 SMA today.",
    prompt: "death cross",
  },
  {
    id: "rsi-oversold",
    name: "RSI oversold",
    category: "Bearish",
    description: "Daily RSI(14) below 30.",
    prompt: "rsi below 30",
  },
  {
    id: "five-red",
    name: "5 consecutive red candles",
    category: "Bearish",
    description: "Five red daily candles in a row.",
    prompt: "consecutive 5 red candles",
  },
  {
    id: "nr7-inside",
    name: "NR7 inside bar",
    category: "Range & volatility",
    description: "Narrowest range of 7 sessions that is also an inside bar.",
    prompt: "nr7 inside bar",
  },
  {
    id: "bb-squeeze-break",
    name: "Close above upper Bollinger band",
    category: "Range & volatility",
    description: "Close crossing above the upper Bollinger band (20,2).",
    prompt: "close crossed above upper bollinger band",
  },
  {
    id: "volume-shockers",
    name: "Volume shockers",
    category: "Volume",
    description: "Volume at least 3x the 20-day average with a green candle.",
    prompt: "volume > 3 x sma(volume,20) and green candle",
  },
  {
    id: "gap-up-volume",
    name: "Gap up with high volume",
    category: "Volume",
    description: "Low above yesterday's high on heavy volume.",
    prompt: "gap up and high volume",
  },
  {
    id: "bull-engulfing",
    name: "Bullish engulfing",
    category: "Patterns",
    description: "Bullish engulfing candle on the daily chart.",
    prompt: "bullish engulfing",
  },
  {
    id: "hammer-oversold",
    name: "Hammer in oversold zone",
    category: "Patterns",
    description: "Hammer with RSI under 40.",
    prompt: "hammer and rsi below 40",
  },
  {
    id: "quality-value",
    name: "Quality at a fair price",
    category: "Fundamental",
    description: "ROE above 15%, PE below 25 and positive EPS.",
    prompt: "roe above 15 and pe below 25 and eps above 0",
  },
  {
    id: "growth",
    name: "Sales and profit growth",
    category: "Fundamental",
    description: "Quarterly YoY sales and profit both growing 20%+.",
    prompt: "yoy sales greater than 20% and profit growth above 20",
  },
];

export function exampleScan(example: ScanExample): Scan {
  const { clauses } = parseMagicPrompt(example.prompt);
  // Clause builder bugs would otherwise silently ship an empty scan.
  const root: Group = { ...emptyGroup(), items: clauses };
  return {
    version: 1,
    name: example.name,
    segment: example.segment ?? "cash",
    root: { ...root, id: newId("g") },
    columns: [],
  };
}
