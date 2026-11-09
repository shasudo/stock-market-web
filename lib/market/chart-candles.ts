import { formatHistoricalDate } from "@/lib/historical-series";

export type ChartTimeframe = "1" | "5" | "15" | "60" | "D" | "W" | "M";

export const CHART_TIMEFRAMES: readonly ChartTimeframe[] = [
  "1",
  "5",
  "15",
  "60",
  "D",
  "W",
  "M",
];

export const INTRADAY_TIMEFRAMES: readonly ChartTimeframe[] = [
  "1",
  "5",
  "15",
  "60",
];

export type ChartTime = string | number;

export interface ChartCandle {
  /** `YYYY-MM-DD` for D/W/M; IST-shifted unix seconds for intraday. */
  readonly time: ChartTime;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

export interface DailyCandle {
  readonly date: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

export interface ChartQuote {
  readonly lastPrice: number;
  readonly prevClose: number;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly netChange: number;
  readonly pctChange: number;
  readonly volume: number | null;
  readonly syncedAt: string;
}

export const IST_OFFSET_SECONDS = 19_800;

export function isIntradayTimeframe(timeframe: ChartTimeframe): boolean {
  return INTRADAY_TIMEFRAMES.includes(timeframe);
}

export function isChartTimeframe(value: string): value is ChartTimeframe {
  return (CHART_TIMEFRAMES as readonly string[]).includes(value);
}

export function istDateOf(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_SECONDS * 1_000)
    .toISOString()
    .slice(0, 10);
}

export function buildDailyCandles(series: {
  readonly timestamps: readonly number[];
  readonly opens: readonly number[];
  readonly highs: readonly number[];
  readonly lows: readonly number[];
  readonly closes: readonly number[];
  readonly volumes: readonly number[];
}): DailyCandle[] {
  const candles: DailyCandle[] = [];
  for (let index = 0; index < series.timestamps.length; index += 1) {
    const date = formatHistoricalDate(series.timestamps[index] ?? 0);
    const open = series.opens[index];
    const high = series.highs[index];
    const low = series.lows[index];
    const close = series.closes[index];
    if (
      !date ||
      open === undefined ||
      high === undefined ||
      low === undefined ||
      close === undefined
    ) {
      continue;
    }
    if (candles.length > 0 && candles[candles.length - 1]!.date >= date) {
      continue;
    }
    candles.push({
      date,
      open,
      high,
      low,
      close,
      volume: series.volumes[index] ?? 0,
    });
  }
  return candles;
}

/**
 * Folds the latest synced quote into the daily series: a newer session day
 * becomes a new candle, the same day patches today's candle so the chart
 * moves with the quote table instead of lagging the nightly history sync.
 */
export function mergeLiveQuoteIntoDaily(
  candles: readonly DailyCandle[],
  quote: ChartQuote | null,
): DailyCandle[] {
  if (!quote || !(quote.lastPrice > 0)) return [...candles];

  const quoteDate = istDateOf(new Date(quote.syncedAt));
  const last = candles[candles.length - 1];
  if (last && quoteDate < last.date) return [...candles];

  const price = quote.lastPrice;
  const open = quote.open && quote.open > 0 ? quote.open : price;
  const high = quote.high && quote.high > 0 ? quote.high : price;
  const low = quote.low && quote.low > 0 ? quote.low : price;
  const volume = quote.volume && quote.volume > 0 ? quote.volume : 0;

  if (last && last.date === quoteDate) {
    const merged: DailyCandle = {
      date: last.date,
      open: last.open,
      high: Math.max(last.high, high, price),
      low: Math.min(last.low, low, price),
      close: price,
      volume: Math.max(last.volume, volume),
    };
    return [...candles.slice(0, -1), merged];
  }

  const todayOpen = open;
  return [
    ...candles,
    {
      date: quoteDate,
      open: todayOpen,
      high: Math.max(high, todayOpen, price),
      low: Math.min(low, todayOpen, price),
      close: price,
      volume,
    },
  ];
}

function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function aggregateDailyCandles(
  candles: readonly DailyCandle[],
  timeframe: "D" | "W" | "M",
): ChartCandle[] {
  if (timeframe === "D") {
    return candles.map(({ date, ...rest }) => ({ time: date, ...rest }));
  }

  const bucketOf = timeframe === "W" ? weekStart : monthStart;
  const result: ChartCandle[] = [];
  let currentBucket = "";
  let current: {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null = null;

  for (const candle of candles) {
    const bucket = bucketOf(candle.date);
    if (current && bucket === currentBucket) {
      current.high = Math.max(current.high, candle.high);
      current.low = Math.min(current.low, candle.low);
      current.close = candle.close;
      current.volume += candle.volume;
      continue;
    }
    if (current) result.push(current);
    currentBucket = bucket;
    current = {
      time: bucket,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    };
  }
  if (current) result.push(current);
  return result;
}

export interface RawIntradayCandle {
  /** Epoch milliseconds, as produced by the Dhan intraday parser. */
  readonly timestamp: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number | null;
}

export function toIntradayChartCandles(
  candles: readonly RawIntradayCandle[],
  intervalMinutes: number,
  quote: ChartQuote | null,
): ChartCandle[] {
  const result: ChartCandle[] = [];
  for (const candle of candles) {
    const time = Math.floor(candle.timestamp / 1_000) + IST_OFFSET_SECONDS;
    const previous = result[result.length - 1];
    if (previous && (previous.time as number) >= time) continue;
    result.push({
      time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume ?? 0,
    });
  }

  const last = result[result.length - 1];
  if (last && quote && quote.lastPrice > 0) {
    const start = (last.time as number) - IST_OFFSET_SECONDS;
    const syncedSeconds = Math.floor(
      new Date(quote.syncedAt).getTime() / 1_000,
    );
    if (
      syncedSeconds >= start &&
      syncedSeconds < start + intervalMinutes * 60
    ) {
      result[result.length - 1] = {
        ...last,
        high: Math.max(last.high, quote.lastPrice),
        low: Math.min(last.low, quote.lastPrice),
        close: quote.lastPrice,
      };
    }
  }
  return result;
}

/**
 * Accepts "RELIANCE", "NSE:RELIANCE", "RELIANCE.NS", "TCS.BO".
 * `exchange` is only set when the input says which listing it wants.
 */
export function parseChartSymbol(input: string): {
  readonly symbol: string;
  readonly exchange: "NSE" | "BSE" | null;
} {
  let value = input.trim().toUpperCase();
  let exchange: "NSE" | "BSE" | null = null;

  const colon = value.indexOf(":");
  if (colon > -1) {
    const prefix = value.slice(0, colon);
    if (prefix === "NSE" || prefix === "BSE") exchange = prefix;
    value = value.slice(colon + 1);
  }
  if (value.endsWith(".NS")) {
    exchange = "NSE";
    value = value.slice(0, -3);
  } else if (value.endsWith(".BO")) {
    exchange = "BSE";
    value = value.slice(0, -3);
  }
  return { symbol: value, exchange };
}
