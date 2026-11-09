import type { AddColumnSelection } from "./screener-columns";

export const TIMEFRAMES = [
  "1 min",
  "3 min",
  "5 min",
  "15 min",
  "30 min",
  "1 Hour",
  "4 Hour",
  "1 Day",
  "1 Week",
  "1 Month",
];

export const TRADING_INSTRUMENTS = [
  "Equity",
  "Futures",
  "Options",
  "Index",
  "Commodity",
  "Currency",
];

export const TRADING_TYPES = [
  "Intraday",
  "Swing",
  "Positional",
  "BTST",
  "Scalping",
  "Long Term",
];

export const STRATEGY_LEGS = [
  { key: "buy", label: "Buy" },
  { key: "initialStopLoss", label: "Initial Stop Loss" },
  { key: "trailingStopLoss", label: "Trailing Stop Loss" },
  { key: "partialBooking", label: "Partial Booking" },
  { key: "exit", label: "Exit" },
] as const;

export type StrategyLegKey = (typeof STRATEGY_LEGS)[number]["key"];

export interface StrategyRow {
  id: string;
  timeframe: string;
  instrument: string;
  tradingType: string;

  buy: AddColumnSelection;
  initialStopLoss: AddColumnSelection;
  trailingStopLoss: AddColumnSelection;
  partialBooking: AddColumnSelection;
  exit: AddColumnSelection;

  custom: Record<string, string>;
}

const leg = (
  groups: Record<string, string[]>,
  timeframes: string[] = ["tf-1day"],
): AddColumnSelection => ({
  timeframes,
  groups,
});

const emptyLeg = (): AddColumnSelection => ({ timeframes: [], groups: {} });

export const MOCK_STRATEGY_ROWS: StrategyRow[] = [
  {
    id: "strat-1",
    timeframe: "15 min",
    instrument: "Equity",
    tradingType: "Intraday",
    buy: leg({ candlesticks: ["bullish-engulfing"], indicators: ["rsi"] }, [
      "tf-15min",
    ]),
    initialStopLoss: leg({ indicators: ["atr"] }, ["tf-15min"]),
    trailingStopLoss: leg({ indicators: ["supertrend"] }, ["tf-15min"]),
    partialBooking: leg({ "drawing-tools": ["fibonacci-extension"] }, [
      "tf-15min",
    ]),
    exit: leg({ candlesticks: ["bearish-engulfing"] }, ["tf-15min"]),
    custom: {},
  },
  {
    id: "strat-2",
    timeframe: "1 Day",
    instrument: "Equity",
    tradingType: "Swing",
    buy: leg({ indicators: ["macd"], "chart-patterns": ["cup-handle"] }),
    initialStopLoss: leg({ "drawing-tools": ["support"] }),
    trailingStopLoss: leg({ indicators: ["ema-20"] }),
    partialBooking: leg({ "chart-patterns": ["triple-top"] }),
    exit: leg({ indicators: ["rsi"] }),
    custom: {},
  },
  {
    id: "strat-3",
    timeframe: "1 Hour",
    instrument: "Futures",
    tradingType: "Intraday",
    buy: leg({ candlesticks: ["bullish-harami"], indicators: ["vwap"] }, [
      "tf-1hour",
    ]),
    initialStopLoss: leg({ indicators: ["parabolic-sar"] }, ["tf-1hour"]),
    trailingStopLoss: leg({ indicators: ["bollinger-bands"] }, ["tf-1hour"]),
    partialBooking: leg({ "drawing-tools": ["resistance"] }, ["tf-1hour"]),
    exit: leg({ candlesticks: ["evening-star"] }, ["tf-1hour"]),
    custom: {},
  },
];

export function makeEmptyStrategyRow(id: string): StrategyRow {
  return {
    id,
    timeframe: TIMEFRAMES[3],
    instrument: TRADING_INSTRUMENTS[0],
    tradingType: TRADING_TYPES[0],
    buy: emptyLeg(),
    initialStopLoss: emptyLeg(),
    trailingStopLoss: emptyLeg(),
    partialBooking: emptyLeg(),
    exit: emptyLeg(),
    custom: {},
  };
}

export const BACKTEST_SOURCES = ["Watchlist", "Sector", "Industry", "Others"];
export const BACKTEST_ENTRY_TYPES = ["Long", "Short"];

export interface BackTestRow {
  id: string;
  source: string;
  entryType: string;
  qty: number;
  buyPrice: number;
  stopLoss: number;
  exit: number;
  strategy: string;
  successRate: number;
}

export function computePnl(row: BackTestRow): number {
  const diff =
    row.entryType === "Short"
      ? row.buyPrice - row.exit
      : row.exit - row.buyPrice;
  return diff * row.qty;
}

export const MOCK_BACKTEST_ROWS: BackTestRow[] = [
  {
    id: "bt-1",
    source: "Watchlist",
    entryType: "Long",
    qty: 100,
    buyPrice: 2450.5,
    stopLoss: 2400,
    exit: 2540.75,
    strategy: "Momentum Breakout",
    successRate: 68,
  },
  {
    id: "bt-2",
    source: "Sector",
    entryType: "Long",
    qty: 50,
    buyPrice: 1680,
    stopLoss: 1650,
    exit: 1625.5,
    strategy: "RSI Reversal",
    successRate: 54,
  },
  {
    id: "bt-3",
    source: "Industry",
    entryType: "Short",
    qty: 75,
    buyPrice: 945.25,
    stopLoss: 970,
    exit: 902.1,
    strategy: "Bearish Engulfing Short",
    successRate: 61,
  },
  {
    id: "bt-4",
    source: "Watchlist",
    entryType: "Long",
    qty: 200,
    buyPrice: 312.4,
    stopLoss: 300,
    exit: 345.9,
    strategy: "EMA Crossover",
    successRate: 72,
  },
  {
    id: "bt-5",
    source: "Others",
    entryType: "Long",
    qty: 30,
    buyPrice: 3540,
    stopLoss: 3480,
    exit: 3495,
    strategy: "Supertrend Trend",
    successRate: 49,
  },
  {
    id: "bt-6",
    source: "Sector",
    entryType: "Short",
    qty: 120,
    buyPrice: 560.75,
    stopLoss: 580,
    exit: 528.3,
    strategy: "Double Top Short",
    successRate: 65,
  },
];

export function makeEmptyBackTestRow(id: string): BackTestRow {
  return {
    id,
    source: BACKTEST_SOURCES[0],
    entryType: BACKTEST_ENTRY_TYPES[0],
    qty: 0,
    buyPrice: 0,
    stopLoss: 0,
    exit: 0,
    strategy: "",
    successRate: 0,
  };
}
