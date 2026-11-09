"use client";

import { useMemo, useState, type ReactElement } from "react";
import {
  BarChart3,
  Bookmark,
  Flame,
  Search,
  ShoppingBag,
  TrendingUp,
  User,
  Wallet,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  getIndicatorDefinition,
  searchIndicatorDefinitions,
} from "@/lib/technical/indicator-catalog";
import {
  loadIndicatorFavorites,
  saveIndicatorFavorites,
  toggleIndicatorFavorite,
} from "@/lib/chart/indicator-favorites";
import {
  compilePineScript,
  registerCompiledScript,
  rehydrateAllPineScripts,
} from "@/lib/pine/pine-script";
import { cn } from "@/lib/utils";

export interface IndicatorPickerProps {
  readonly open: boolean;
  readonly onSelect: (definitionId: string) => void;
  readonly onClose: () => void;
  readonly onSelectMultiple?: (definitionIds: readonly string[]) => void;
  readonly symbol?: string;
  /** False for index symbols, which have no fundamentals feed. */
  readonly hasFundamentals?: boolean;
  /** Opens the docked Pine Editor instead of the inline script composer. */
  readonly onCreateScript?: () => void;
}

type SectionId =
  | "scripts"
  | "purchased"
  | "technicals"
  | "fundamentals"
  | "editors"
  | "top"
  | "trending"
  | "marketplace";

type CommunityKind = "indicator" | "strategy";

interface CommunityScript {
  readonly name: string;
  readonly author: string;
  readonly boosts: string;
  readonly kind: CommunityKind;
  readonly editorsPick?: boolean;
  /** Built-in indicator ids applied when the script is chosen. */
  readonly mapsTo: readonly string[];
  readonly sections: readonly SectionId[];
}

const COMMUNITY: readonly CommunityScript[] = [
  {
    name: "Smart Money Concepts (SMC) [LuxAlgo]",
    author: "LuxAlgo",
    boosts: "178.4K",
    kind: "indicator",
    mapsTo: ["supertrend", "atr", "volume"],
    sections: ["top"],
  },
  {
    name: "Squeeze Momentum Indicator [LazyBear]",
    author: "LazyBear",
    boosts: "117.8K",
    kind: "indicator",
    mapsTo: ["bollinger-bands", "macd"],
    sections: ["top"],
  },
  {
    name: "SuperTrend",
    author: "KivancOzbilgic",
    boosts: "84.8K",
    kind: "indicator",
    mapsTo: ["supertrend"],
    sections: ["top"],
  },
  {
    name: "MacD Custom Indicator-Multiple Time Frame",
    author: "ChrisMoody",
    boosts: "82.7K",
    kind: "indicator",
    mapsTo: ["macd"],
    sections: ["top"],
  },
  {
    name: "Support and Resistance Levels with Breaks",
    author: "LuxAlgo",
    boosts: "67.2K",
    kind: "indicator",
    mapsTo: ["bollinger-bands", "sma"],
    sections: ["top"],
  },
  {
    name: "CM_Williams_Vix_Fix Finds Market Bottoms",
    author: "ChrisMoody",
    boosts: "66.1K",
    kind: "indicator",
    mapsTo: ["historical-volatility", "stdev"],
    sections: ["top"],
  },
  {
    name: "Market Structure Break & Order Blocks",
    author: "EmreKb",
    boosts: "64.6K",
    kind: "indicator",
    editorsPick: true,
    mapsTo: ["supertrend", "ema"],
    sections: ["top"],
  },
  {
    name: "UT Bot Alerts",
    author: "QuantNomad",
    boosts: "61.5K",
    kind: "indicator",
    mapsTo: ["supertrend", "atr"],
    sections: ["top"],
  },
  {
    name: "Indicator: WaveTrend Oscillator [WT]",
    author: "LazyBear",
    boosts: "61.4K",
    kind: "indicator",
    mapsTo: ["stochastic", "rsi"],
    sections: ["top"],
  },
  {
    name: "ICT Killzones + Pivots [TFO]",
    author: "tradeforopp",
    boosts: "59.7K",
    kind: "indicator",
    editorsPick: true,
    mapsTo: ["vwap", "atr"],
    sections: ["top"],
  },
  {
    name: "Trendlines with Breaks [LuxAlgo]",
    author: "LuxAlgo",
    boosts: "53.8K",
    kind: "indicator",
    mapsTo: ["sma", "ema"],
    sections: ["top"],
  },
  {
    name: "Bollinger + RSI, Double Strategy",
    author: "ChartArt",
    boosts: "49.2K",
    kind: "strategy",
    mapsTo: ["bollinger-bands", "rsi"],
    sections: ["top"],
  },
  {
    name: "Support Resistance Channels",
    author: "LonesomeTheBlue",
    boosts: "48.3K",
    kind: "indicator",
    editorsPick: true,
    mapsTo: ["bollinger-bands", "sma"],
    sections: ["top"],
  },
  {
    name: "Swing high low support & resistance",
    author: "Patternsmart",
    boosts: "46K",
    kind: "indicator",
    mapsTo: ["atr", "sma"],
    sections: ["top"],
  },
  {
    name: "Shaakuni - Liquidity Levels & Order Blocks",
    author: "maharaja3qwer",
    boosts: "4.8K",
    kind: "indicator",
    mapsTo: ["bollinger-bands", "volume"],
    sections: ["trending"],
  },
  {
    name: "Buyers & Sellers Profile + Dynamic S/R",
    author: "Zeiierman",
    boosts: "7.7K",
    kind: "indicator",
    editorsPick: true,
    mapsTo: ["volume", "vwap"],
    sections: ["trending", "editors"],
  },
  {
    name: "Rolling Candle Profile with Buy/Sell Signals",
    author: "Zeiierman",
    boosts: "3.3K",
    kind: "indicator",
    editorsPick: true,
    mapsTo: ["volume", "sma"],
    sections: ["trending", "editors"],
  },
  {
    name: "Gold Breakout 15M Strategy [Willy]",
    author: "WillyAlgoTrader",
    boosts: "2.6K",
    kind: "strategy",
    mapsTo: ["supertrend", "atr", "volume"],
    sections: ["trending"],
  },
  {
    name: "Smart Money Liquidity Structure [TradingFinder]",
    author: "TradingFinder",
    boosts: "2.5K",
    kind: "indicator",
    mapsTo: ["supertrend", "atr"],
    sections: ["trending"],
  },
  {
    name: "Anchored VWAP Pullback & Target Zones",
    author: "PhenLabs",
    boosts: "2.2K",
    kind: "indicator",
    mapsTo: ["vwap", "ema"],
    sections: ["trending"],
  },
  {
    name: "Pure Momentum Oscillator",
    author: "MisinkoMaster",
    boosts: "1.7K",
    kind: "indicator",
    mapsTo: ["roc", "rsi"],
    sections: ["trending"],
  },
  {
    name: "Supertrend with Entry, TP1, TP2 & TP3",
    author: "wojtek_s730ir",
    boosts: "1.8K",
    kind: "indicator",
    mapsTo: ["supertrend", "atr"],
    sections: ["trending"],
  },
  {
    name: "Market Matrix (Zeiierman)",
    author: "Zeiierman",
    boosts: "1.4K",
    kind: "indicator",
    editorsPick: true,
    mapsTo: ["macd", "rsi"],
    sections: ["trending", "editors"],
  },
  {
    name: "Volume Delta Oscillator with Divergence",
    author: "BigBeluga",
    boosts: "1.4K",
    kind: "indicator",
    mapsTo: ["obv", "macd"],
    sections: ["trending"],
  },
  {
    name: "SUPER INDIBOT kd v2",
    author: "ak147ak",
    boosts: "2.2K",
    kind: "indicator",
    mapsTo: ["rsi", "ema"],
    sections: ["trending"],
  },
  {
    name: "VWAP Range Breakout (Zeiierman)",
    author: "Zeiierman",
    boosts: "1.3K",
    kind: "indicator",
    mapsTo: ["vwap", "bollinger-bands"],
    sections: ["trending"],
  },
  {
    name: "Trend Volume Profile and Rolling POC",
    author: "BigBeluga",
    boosts: "1.2K",
    kind: "indicator",
    mapsTo: ["volume", "vwap"],
    sections: ["trending"],
  },
  {
    name: "Curved Trendlines (Zeiierman)",
    author: "Zeiierman",
    boosts: "1.2K",
    kind: "indicator",
    mapsTo: ["sma", "ema"],
    sections: ["trending"],
  },
  {
    name: "Innovation Adaptive Kalman Filter Oscillator",
    author: "jdehorty",
    boosts: "1.2K",
    kind: "indicator",
    mapsTo: ["ema", "sma"],
    sections: ["editors"],
  },
  {
    name: "RedK Indicator Amplifier (RedK i-Amp)",
    author: "RedKTrader",
    boosts: "963",
    kind: "indicator",
    mapsTo: ["rsi", "macd"],
    sections: ["editors"],
  },
  {
    name: "TASC 2026.10 A Low-Risk ETF-Trading System",
    author: "PineCoders",
    boosts: "1K",
    kind: "strategy",
    mapsTo: ["sma", "ema"],
    sections: ["editors"],
  },
  {
    name: "Vol-Control Fund Positioning",
    author: "EdgeTools",
    boosts: "436",
    kind: "indicator",
    mapsTo: ["volume", "obv"],
    sections: ["editors"],
  },
  {
    name: "RedK Multi-Modal TrailingStop (RedK M-TSP)",
    author: "RedKTrader",
    boosts: "1.2K",
    kind: "indicator",
    mapsTo: ["supertrend", "atr"],
    sections: ["editors"],
  },
  {
    name: "Trend Target Ribbon [BOSWaves]",
    author: "BOSWaves",
    boosts: "6K",
    kind: "indicator",
    mapsTo: ["ema", "sma"],
    sections: ["editors"],
  },
  {
    name: "Wyckoff [theUltimator5]",
    author: "TheUltimator5",
    boosts: "8K",
    kind: "indicator",
    mapsTo: ["volume", "obv"],
    sections: ["editors"],
  },
  {
    name: "Dual-Phase Reversal by DGT",
    author: "dgtrd",
    boosts: "2K",
    kind: "indicator",
    mapsTo: ["stochastic", "rsi"],
    sections: ["editors"],
  },
  {
    name: "Zeiierman Trend Pressure (Zeiierman)",
    author: "Zeiierman",
    boosts: "2.4K",
    kind: "indicator",
    mapsTo: ["macd", "rsi"],
    sections: ["editors"],
  },
  {
    name: "Volume Delta Footprint Map (Zeiierman)",
    author: "Zeiierman",
    boosts: "2.7K",
    kind: "indicator",
    mapsTo: ["obv", "volume"],
    sections: ["editors"],
  },
  {
    name: "Initial Balance Auction Intelligence by DGT",
    author: "dgtrd",
    boosts: "2K",
    kind: "indicator",
    mapsTo: ["vwap", "atr"],
    sections: ["editors"],
  },
];

/**
 * Built-in technical rows in TradingView order. Every row resolves to a real,
 * working engine definition — researched from each indicator's published
 * formula. Rob Booker rows are community scripts, applied through their
 * closest built-in equivalents.
 */
const TECHNICALS: readonly { readonly name: string; readonly mapsTo: string }[] =
  [
    { name: "24-hour volume", mapsTo: "volume" },
    { name: "Accumulation/distribution", mapsTo: "ad" },
    { name: "Advance-decline line", mapsTo: "ad" },
    { name: "Advance-decline ratio", mapsTo: "ad" },
    { name: "Advance-decline ratio (bars)", mapsTo: "volume" },
    { name: "Arnaud Legoux moving average", mapsTo: "alma" },
    { name: "Aroon", mapsTo: "aroon" },
    { name: "Aroon oscillator", mapsTo: "aroonosc" },
    { name: "Auto anchored volume profile", mapsTo: "aavp" },
    { name: "Auto fib extension", mapsTo: "linregchannel" },
    { name: "Auto fib retracement", mapsTo: "linregchannel" },
    { name: "Auto key levels", mapsTo: "pivots" },
    { name: "Auto pitchfork", mapsTo: "linregchannel" },
    { name: "Auto trendlines", mapsTo: "zigzag" },
    { name: "Average daily range", mapsTo: "adr" },
    { name: "Average directional index", mapsTo: "adx" },
    { name: "Average True Range", mapsTo: "atr" },
    { name: "Awesome oscillator", mapsTo: "awesome" },
    { name: "Balance of power", mapsTo: "bop" },
    { name: "BBTrend", mapsTo: "bbtrend" },
    { name: "Bollinger Bands", mapsTo: "bollinger-bands" },
    { name: "Bollinger Bands %b", mapsTo: "bollinger-percent-b" },
    { name: "Bollinger BandWidth", mapsTo: "bollinger-bandwidth" },
    { name: "Bollinger Bars", mapsTo: "bollingerbars" },
    { name: "Bull bear power", mapsTo: "bullbear" },
    { name: "Chaikin money flow", mapsTo: "cmf" },
    { name: "Chaikin oscillator", mapsTo: "chaikin" },
    { name: "Chande Kroll stop", mapsTo: "chandekroll" },
    { name: "Chande momentum oscillator", mapsTo: "cmo" },
    { name: "Chandelier exit", mapsTo: "chandelier" },
    { name: "Chop zone", mapsTo: "chopzone" },
    { name: "Choppiness index", mapsTo: "chop" },
    { name: "Commodity channel index", mapsTo: "cci" },
    { name: "Connors RSI", mapsTo: "connorsrsi" },
    { name: "Coppock curve", mapsTo: "coppock" },
    { name: "Correlation coefficient", mapsTo: "corr" },
    { name: "Cumulative volume delta", mapsTo: "cvd" },
    { name: "Cumulative volume index", mapsTo: "cumvolidx" },
    { name: "Detrended price oscillator", mapsTo: "dpo" },
    { name: "Directional movement index", mapsTo: "dmi" },
    { name: "Donchian channels", mapsTo: "donchian" },
    { name: "Double exponential moving average", mapsTo: "dema" },
    { name: "Ease of movement", mapsTo: "emv" },
    { name: "Elder's force index", mapsTo: "forceindex" },
    { name: "Envelope", mapsTo: "envelope" },
    { name: "Exponential moving average", mapsTo: "ema" },
    { name: "Fisher transform", mapsTo: "fisher" },
    { name: "Fixed range volume profile", mapsTo: "frvp" },
    { name: "Gaps", mapsTo: "gaps" },
    { name: "Historical volatility", mapsTo: "historical-volatility" },
    { name: "Hull moving average", mapsTo: "hull" },
    { name: "Ichimoku cloud", mapsTo: "ichimoku" },
    { name: "Kaufman's adaptive moving average", mapsTo: "kama" },
    { name: "Keltner channels", mapsTo: "keltner" },
    { name: "Klinger oscillator", mapsTo: "klinger" },
    { name: "Know sure thing", mapsTo: "kst" },
    { name: "Least squares moving average", mapsTo: "lsma" },
    { name: "Linear Regression", mapsTo: "linreg" },
    { name: "Linear regression channel", mapsTo: "linregchannel" },
    { name: "Mass index", mapsTo: "massindex" },
    { name: "McGinley dynamic", mapsTo: "mcginley" },
    { name: "Median", mapsTo: "median" },
    { name: "Momentum", mapsTo: "mom" },
    { name: "Money flow index", mapsTo: "mfi" },
    { name: "Moon phases", mapsTo: "moon" },
    { name: "Moving average convergence divergence", mapsTo: "macd" },
    { name: "Moving average crossover", mapsTo: "macross" },
    { name: "Moving average ribbon", mapsTo: "maribbon" },
    { name: "Negative volume index", mapsTo: "nvi" },
    { name: "Net volume", mapsTo: "netvol" },
    { name: "On-balance volume", mapsTo: "obv" },
    { name: "Parabolic SAR", mapsTo: "psar" },
    { name: "Percentage volume oscillator", mapsTo: "pvo" },
    { name: "Performance", mapsTo: "perf" },
    { name: "Periodic volume profile", mapsTo: "pvp" },
    { name: "Pivot points high low", mapsTo: "pivotshl" },
    { name: "Pivot points standard", mapsTo: "pivots" },
    { name: "Positive volume index", mapsTo: "pvi" },
    { name: "Price momentum oscillator", mapsTo: "pmo" },
    { name: "Price oscillator", mapsTo: "ppo" },
    { name: "Price-volume trend", mapsTo: "pvtrend" },
    { name: "Pring's special K", mapsTo: "specialk" },
    { name: "Rank correlation index", mapsTo: "rci" },
    { name: "Rate of change", mapsTo: "roc" },
    { name: "RCI ribbon", mapsTo: "rciribbon" },
    { name: "Relative strength index", mapsTo: "rsi" },
    { name: "Relative vigor index", mapsTo: "rvgi" },
    { name: "Relative volatility index", mapsTo: "rvi" },
    { name: "Relative volume at time", mapsTo: "rvat" },
    { name: "Rob Booker - ADX breakout", mapsTo: "adx" },
    { name: "Rob Booker - intraday pivot points", mapsTo: "pivots" },
    { name: "Rob Booker - Knoxville divergence", mapsTo: "stochastic" },
    { name: "Rob Booker - missed pivot points", mapsTo: "pivots" },
    { name: "Rob Booker - reversal", mapsTo: "supertrend" },
    { name: "Rob Booker — Ziv ghost pivots", mapsTo: "pivots" },
    { name: "RSI divergence indicator", mapsTo: "rsidiv" },
    { name: "RSI strategy", mapsTo: "rsi" },
    { name: "Seasonality", mapsTo: "season" },
    { name: "Session time price opportunity", mapsTo: "stpo" },
    { name: "Session Volume (session total)", mapsTo: "sessvol" },
    { name: "Session volume profile", mapsTo: "svp" },
    { name: "Session volume profile HD", mapsTo: "svphd" },
    { name: "Simple moving average", mapsTo: "sma" },
    { name: "SMI ergodic indicator", mapsTo: "smi" },
    { name: "SMI ergodic oscillator", mapsTo: "smiosc" },
    { name: "Smoothed moving average", mapsTo: "smma" },
    { name: "Stochastic", mapsTo: "stochastic" },
    { name: "Stochastic momentum index", mapsTo: "smimom" },
    { name: "Stochastic RSI", mapsTo: "stochrsi" },
    { name: "Supertrend", mapsTo: "supertrend" },
    { name: "Time price opportunity", mapsTo: "tpo" },
    { name: "Time-weighted average price", mapsTo: "twap" },
    { name: "Trend strength index", mapsTo: "adx" },
    { name: "TRIX", mapsTo: "trix" },
    { name: "Triple exponential moving average", mapsTo: "tema" },
    { name: "True range", mapsTo: "true-range" },
    { name: "True strength index", mapsTo: "tsi" },
    { name: "Ulcer index", mapsTo: "ulcer" },
    { name: "Ultimate oscillator", mapsTo: "ultosc" },
    { name: "Up/down volume", mapsTo: "updownvol" },
    { name: "Visible average price", mapsTo: "visavg" },
    { name: "Visible range volume profile", mapsTo: "vrvp" },
    { name: "Volatility stop", mapsTo: "vstop" },
    { name: "Volume", mapsTo: "volume" },
    { name: "Volume delta", mapsTo: "voldelta" },
    { name: "Volume-weighted average price", mapsTo: "vwap" },
    { name: "Volume-weighted moving average", mapsTo: "vwma" },
    { name: "Vortex indicator", mapsTo: "vortex" },
    { name: "VWAP auto-anchored", mapsTo: "vwapanchored" },
    { name: "Weighted moving average", mapsTo: "wma" },
    { name: "Williams alligator", mapsTo: "alligator" },
    { name: "Williams fractal", mapsTo: "fractal" },
    { name: "Williams percent range", mapsTo: "willr" },
    { name: "Woodies CCI", mapsTo: "woodies" },
    { name: "Zigzag", mapsTo: "zigzag" },
  ];

const STRATEGY_BUNDLES: readonly {
  readonly name: string;
  readonly description: string;
  readonly ids: readonly string[];
}[] = [
  {
    name: "Trend Follower",
    description: "EMA trend filter with MACD momentum and a Supertrend trail.",
    ids: ["ema", "macd", "supertrend"],
  },
  {
    name: "Mean Reversion",
    description: "RSI and Stochastic extremes against Bollinger edges.",
    ids: ["rsi", "bollinger-bands", "stochastic"],
  },
  {
    name: "Breakout",
    description: "ATR expansion with volume confirmation and OBV flow.",
    ids: ["atr", "volume", "obv"],
  },
  {
    name: "Momentum",
    description: "ROC impulse with MACD cross and CCI thrust.",
    ids: ["roc", "macd", "cci"],
  },
];

const MARKETPLACE: readonly CommunityScript[] = [
  {
    name: "Buyers & Sellers Profile + Dynamic S/R Pro",
    author: "Zeiierman",
    boosts: "7.7K",
    kind: "indicator",
    editorsPick: true,
    mapsTo: ["volume", "vwap"],
    sections: ["marketplace"],
  },
  {
    name: "Market Matrix Suite (Zeiierman)",
    author: "Zeiierman",
    boosts: "1.4K",
    kind: "indicator",
    editorsPick: true,
    mapsTo: ["macd", "rsi"],
    sections: ["marketplace"],
  },
  {
    name: "RedK Dual Suite (i-Amp + TrailingStop)",
    author: "RedKTrader",
    boosts: "2.1K",
    kind: "indicator",
    mapsTo: ["rsi", "supertrend"],
    sections: ["marketplace"],
  },
  {
    name: "Volume Delta Institutional Pack",
    author: "BigBeluga",
    boosts: "4.1K",
    kind: "indicator",
    mapsTo: ["obv", "volume"],
    sections: ["marketplace"],
  },
];

const MY_SCRIPTS_KEY = "chart:pine:my-scripts:v1";
const DEFAULT_PINE = `// This Pine Script® code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/

//@version=6
indicator("My script")
plot(close)`;

interface PineScript {
  readonly name: string;
  readonly code: string;
}

function readMyScripts(): PineScript[] {
  try {
    const raw = window.localStorage.getItem(MY_SCRIPTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PineScript =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as PineScript).name === "string",
    );
  } catch {
    return [];
  }
}

function scriptTitle(name: string): string {
  return name.length > 42 ? `${name.slice(0, 41)}…` : name;
}

type Pill = "all" | "indicators" | "strategies" | "profiles" | "patterns" | "options";

const COMMUNITY_PILLS: readonly Pill[] = ["all", "indicators", "strategies"];
const TECHNICAL_PILLS: readonly Pill[] = [
  "indicators",
  "strategies",
  "profiles",
  "patterns",
  "options",
];

const PROFILE_IDS = [
  "tpo",
  "stpo",
  "aavp",
  "frvp",
  "pvp",
  "svp",
  "svphd",
  "vrvp",
];
const PATTERN_IDS = ["supertrend", "sma", "ema", "atr"];
const OPTION_IDS = [
  "historical-volatility",
  "max-drawdown",
  "stdev",
  "true-range",
  "atr",
];

export default function IndicatorPicker({
  open,
  onSelect,
  onClose,
  onSelectMultiple,
  hasFundamentals = false,
  onCreateScript,
}: IndicatorPickerProps) {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<SectionId>("trending");
  const [pill, setPill] = useState<Pill>("all");
  const [pineOpen, setPineOpen] = useState(false);
  const [pineCode, setPineCode] = useState(DEFAULT_PINE);
  const [pineName, setPineName] = useState("My script");
  const [myScripts, setMyScripts] = useState<PineScript[]>(() =>
    typeof window === "undefined" ? [] : readMyScripts(),
  );
  const [favorites, setFavorites] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : loadIndicatorFavorites(),
  );

  const matches = useMemo(() => searchIndicatorDefinitions(query), [query]);
  const needle = query.trim().toLowerCase();

  // Saved scripts can change outside the picker (docked Pine Editor), so
  // refresh the list and the compiled registry every time it opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      rehydrateAllPineScripts();
      if (typeof window !== "undefined") setMyScripts(readMyScripts());
    }
  }

  if (!open) return null;

  const pills: readonly Pill[] =
    section === "technicals" ? TECHNICAL_PILLS : COMMUNITY_PILLS;

  const switchSection = (next: SectionId): void => {
    setSection(next);
    setPineOpen(false);
    setPill(next === "technicals" ? "indicators" : "all");
  };

  /** First visible row in render order — Enter applies it like TradingView. */
  const applyFirst = (): void => {
    if (pineOpen) return;
    if (searching) {
      const technical = technicalRows();
      if (technical.length > 0) {
        const first = technical[0]!;
        applyIds([first.mapsTo], first.name);
        return;
      }
      const community = filteredCommunity(COMMUNITY);
      if (community.length > 0) {
        const first = community[0]!;
        applyIds(first.mapsTo, scriptTitle(first.name));
        return;
      }
      if (matches.length > 0) {
        const first = matches[0]!;
        applyIds([first.id], first.name);
      }
      return;
    }
    if (section === "technicals") {
      if (pill === "strategies") {
        const strategy = STRATEGY_BUNDLES.find((entry) =>
          entry.name.toLowerCase().includes(needle),
        );
        if (strategy) applyIds(strategy.ids, strategy.name);
        return;
      }
      const rows = technicalRows();
      if (rows.length > 0) {
        const first = rows[0]!;
        applyIds([first.mapsTo], first.name);
      }
      return;
    }
    if (
      section === "editors" ||
      section === "top" ||
      section === "trending" ||
      section === "marketplace"
    ) {
      const rows = filteredCommunity(communityFor(section));
      if (rows.length > 0) {
        const first = rows[0]!;
        applyIds(first.mapsTo, scriptTitle(first.name));
      }
    }
  };

  const applyIds = (ids: readonly string[], label: string): void => {
    const valid = ids.filter((id) => getIndicatorDefinition(id) !== undefined);
    if (valid.length === 0) return;
    if (valid.length > 1 && onSelectMultiple) {
      onSelectMultiple(valid);
    } else {
      for (const id of valid) onSelect(id);
    }
    const names = valid
      .map((id) => getIndicatorDefinition(id)?.shortName ?? id)
      .join(" · ");
    toast.success(`${label} → applied ${names}`);
    onClose();
  };

  const toggleStar = (definitionId: string): void => {
    setFavorites((current) => {
      const next = toggleIndicatorFavorite(current, definitionId);
      saveIndicatorFavorites(next);
      return next;
    });
  };

  const persistPine = (): string => {
    const name = pineName.trim() || "My script";
    const next = [
      ...myScripts.filter((entry) => entry.name !== name),
      { name, code: pineCode },
    ];
    setMyScripts(next);
    try {
      window.localStorage.setItem(MY_SCRIPTS_KEY, JSON.stringify(next));
    } catch {
      // Quota or privacy mode; the list simply won't persist.
    }
    return name;
  };

  const savePine = (): void => {
    toast.success(`Saved "${persistPine()}" to My scripts`);
  };

  /** Compile a script and add it to the chart; errors stay in the editor. */
  const applyPineScript = (name: string, code: string): void => {
    const compiled = compilePineScript(name, code);
    if (!compiled.definition) {
      toast.error(compiled.error ?? "Could not compile the script");
      return;
    }
    registerCompiledScript(name, code, compiled.definition);
    if (compiled.warnings.length > 0) {
      toast(compiled.warnings.join(" "), { duration: 6000 });
    }
    applyIds([compiled.definition.id], compiled.definition.name);
  };

  const publishPine = (): void => {
    toast.success(
      `Published "${persistPine()}" — free for this workspace, listed under My scripts.`,
    );
  };

  const communityFor = (id: SectionId): CommunityScript[] => {
    if (id === "marketplace") return [...MARKETPLACE];
    const rows = COMMUNITY.filter((entry) => entry.sections.includes(id));
    if (pill === "indicators")
      return rows.filter((entry) => entry.kind === "indicator");
    if (pill === "strategies")
      return rows.filter((entry) => entry.kind === "strategy");
    return rows;
  };

  const filteredCommunity = (
    rows: readonly CommunityScript[],
  ): readonly CommunityScript[] => {
    if (!needle) return rows;
    return rows.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle) ||
        entry.author.toLowerCase().includes(needle),
    );
  };

  const technicalRows = (): readonly { name: string; mapsTo: string }[] => {
    if (pill === "strategies") return [];
    let rows = TECHNICALS;
    if (pill === "profiles")
      rows = rows.filter((entry) => PROFILE_IDS.includes(entry.mapsTo));
    if (pill === "patterns")
      rows = rows.filter((entry) => PATTERN_IDS.includes(entry.mapsTo));
    if (pill === "options")
      rows = rows.filter((entry) => OPTION_IDS.includes(entry.mapsTo));
    if (!needle) return rows;
    return rows.filter((entry) => entry.name.toLowerCase().includes(needle));
  };

  const renderCommunityRow = (entry: CommunityScript): ReactElement => (
    <button
      key={`${entry.name}-${entry.author}`}
      type="button"
      onClick={() => applyIds(entry.mapsTo, scriptTitle(entry.name))}
      title={`Add ${entry.name} (applies its built-in equivalent)`}
      className="grid w-full grid-cols-[1fr_110px_64px] items-center gap-2 px-4 py-2 text-left hover:bg-muted"
    >
      <span className="flex min-w-0 items-center gap-2 text-[14px] text-foreground">
        <span className="truncate">{entry.name}</span>
        {entry.editorsPick && (
          <span className="shrink-0 rounded bg-primary/10 px-1 py-px text-[10px] font-bold text-primary">
            EP
          </span>
        )}
        {entry.kind === "strategy" && (
          <span
            aria-label="Strategy"
            className="shrink-0 text-[13px] text-muted-foreground"
          >
            ⇄
          </span>
        )}
      </span>
      <span className="truncate text-right text-[14px] text-primary">
        {entry.author}
      </span>
      <span className="text-right text-[14px] text-foreground">
        {entry.boosts}
      </span>
    </button>
  );

  const renderTechnicalRow = (entry: {
    name: string;
    mapsTo: string;
  }): ReactElement | null => {
    const definition = getIndicatorDefinition(entry.mapsTo);
    if (!definition) return null;
    const starred = favorites.includes(definition.id);
    return (
      <div
        key={entry.name}
        className="group/row flex items-center px-2 hover:bg-muted"
      >
        <button
          type="button"
          onClick={() => applyIds([definition.id], definition.name)}
          title={definition.description}
          className="min-w-0 flex-1 px-2 py-2 text-left text-[14px] text-foreground"
        >
          {entry.name}
        </button>
        <button
          type="button"
          onClick={() => toggleStar(definition.id)}
          aria-label={
            starred
              ? `Remove ${definition.name} from favorites`
              : `Star ${definition.name}`
          }
          aria-pressed={starred}
          className={cn(
            "rounded p-1.5 text-muted-foreground/70 hover:bg-muted hover:text-warning",
            starred
              ? "opacity-100"
              : "opacity-0 focus:opacity-100 group-hover/row:opacity-100",
          )}
        >
          <span aria-hidden className="text-[15px]">
            {starred ? "★" : "☆"}
          </span>
        </button>
      </div>
    );
  };

  const searching = needle.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[6vh]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Indicators, metrics, and strategies"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        className="flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <h2 className="text-[20px] font-bold text-foreground">
            Indicators, metrics, and strategies
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1.5 text-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-3 pt-2">
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 focus-within:border-primary">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyFirst();
                }
              }}
              placeholder="Search"
              aria-label="Search indicators, metrics, and strategies"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="rounded-full bg-border p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Indicator library sections"
            className="w-52 shrink-0 overflow-y-auto px-3 pb-4"
          >
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Personal
            </p>
            {(
              [
                { id: "scripts", label: "My scripts", Icon: User },
                { id: "purchased", label: "Saved", Icon: Wallet },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => switchSection(id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[14px]",
                  section === id
                    ? "bg-muted font-semibold text-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon
                  className="h-5 w-5 shrink-0"
                  strokeWidth={1.5}
                />
                {label}
              </button>
            ))}

            <p className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Built-in
            </p>
            {(
              [
                { id: "technicals", label: "Technicals", Icon: BarChart3 },
                { id: "fundamentals", label: "Fundamentals", Icon: BarChart3 },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => switchSection(id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[14px]",
                  section === id
                    ? "bg-muted font-semibold text-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                {label}
              </button>
            ))}

            <p className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Community
            </p>
            {(
              [
                { id: "editors", label: "Editors' picks", Icon: Bookmark },
                { id: "top", label: "Top", Icon: TrendingUp },
                { id: "trending", label: "Trending", Icon: Flame },
                { id: "marketplace", label: "Marketplace", Icon: ShoppingBag },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => switchSection(id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[14px]",
                  section === id
                    ? "bg-muted font-semibold text-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex min-w-0 flex-1 flex-col">
            {!pineOpen &&
              (section === "technicals" ||
                section === "editors" ||
                section === "top" ||
                section === "trending" ||
                section === "marketplace") && (
                <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
                  {pills.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => setPill(entry)}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 text-[13px] font-medium capitalize",
                        pill === entry
                          ? "bg-foreground text-primary-foreground"
                          : "bg-muted text-foreground hover:bg-muted",
                      )}
                    >
                      {entry}
                    </button>
                  ))}
                </div>
              )}

            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              {pineOpen ? (
                <div className="flex h-full flex-col px-4">
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPineOpen(false)}
                      className="rounded px-2 py-1 text-[13px] font-semibold text-primary hover:bg-muted"
                    >
                      ← Back
                    </button>
                    <input
                      value={pineName}
                      onChange={(event) => setPineName(event.target.value)}
                      aria-label="Script name"
                      className="min-w-0 flex-1 rounded border border-border px-2 py-1 text-[14px] font-semibold focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const name = persistPine();
                        applyPineScript(name, pineCode);
                      }}
                      className="rounded-md border border-border px-3 py-1.5 text-[13px] font-semibold hover:bg-muted"
                    >
                      Add to chart
                    </button>
                    <button
                      type="button"
                      onClick={savePine}
                      className="rounded-md px-3 py-1.5 text-[13px] font-semibold text-primary hover:bg-muted"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={publishPine}
                      className="rounded-md border border-border px-3 py-1.5 text-[13px] font-semibold hover:bg-muted"
                    >
                      Publish script
                    </button>
                  </div>
                  <textarea
                    value={pineCode}
                    onChange={(event) => setPineCode(event.target.value)}
                    spellCheck={false}
                    aria-label="Pine Script code"
                    className="min-h-[320px] flex-1 rounded-lg border border-border bg-muted p-3 font-mono text-[13px] leading-5 text-foreground focus:border-primary focus:outline-none"
                  />
                  <p className="pt-2 text-[12px] text-muted-foreground">
                    Pine Script® v6 subset: indicator(), ta.ema/sma/wma/rma/
                    rsi/vwma/crossover/crossunder, nz, math.max/min/abs,
                    input.* (defaults), plot(), hline(). Scripts compile to
                    real indicators and are stored locally under My scripts.
                  </p>
                </div>
              ) : section === "scripts" ? (
                myScripts.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                    <svg
                      aria-hidden
                      viewBox="0 0 120 80"
                      className="h-24 w-32 text-foreground"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    >
                      <path d="M60 6 96 52l-14 2-12-8-10 6-12-4z" />
                      <path d="M28 74 48 44l-8 30z" />
                      <path d="M92 74l-6-16 14 4 8 12z" />
                      <path d="M24 74h72" />
                    </svg>
                    <p className="pt-4 text-[17px] font-bold text-foreground">
                      No personal scripts, yet
                    </p>
                    <p className="max-w-md pt-1 text-[14px] text-foreground">
                      Start creating your own indicators and strategies with
                      Pine Script®, or remix an existing one to make it yours.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (onCreateScript) {
                          onCreateScript();
                          return;
                        }
                        setPineCode(DEFAULT_PINE);
                        setPineOpen(true);
                      }}
                      className="mt-4 rounded-lg bg-foreground px-4 py-2 text-[14px] font-semibold text-primary-foreground hover:bg-foreground/90"
                    >
                      Create script
                    </button>
                  </div>
                ) : (
                  <div className="px-2">
                    {myScripts
                      .filter(
                        (entry) =>
                          !needle ||
                          entry.name.toLowerCase().includes(needle),
                      )
                      .map((entry) => (
                        <div
                          key={entry.name}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted"
                        >
                          <button
                            type="button"
                            title={`Add ${entry.name} to the chart`}
                            onClick={() => applyPineScript(entry.name, entry.code)}
                            className="min-w-0 flex-1 truncate text-left text-[14px] text-foreground"
                          >
                            {entry.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPineName(entry.name);
                              setPineCode(entry.code);
                              setPineOpen(true);
                            }}
                            aria-label={`Edit ${entry.name}`}
                            title={`Edit ${entry.name}`}
                            className="rounded px-2 py-1 text-[13px] text-primary hover:bg-primary/10"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = myScripts.filter(
                                (item) => item.name !== entry.name,
                              );
                              setMyScripts(next);
                              try {
                                window.localStorage.setItem(
                                  MY_SCRIPTS_KEY,
                                  JSON.stringify(next),
                                );
                              } catch {
                                // Ignore storage failures.
                              }
                            }}
                            aria-label={`Delete ${entry.name}`}
                            className="rounded px-2 py-1 text-[13px] text-muted-foreground hover:text-error"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    <button
                      type="button"
                      onClick={() => {
                        if (onCreateScript) {
                          onCreateScript();
                          return;
                        }
                        setPineCode(DEFAULT_PINE);
                        setPineName("My script");
                        setPineOpen(true);
                      }}
                      className="ml-2 mt-2 rounded-lg bg-foreground px-4 py-2 text-[14px] font-semibold text-primary-foreground hover:bg-foreground/90"
                    >
                      Create script
                    </button>
                  </div>
                )
              ) : section === "purchased" ? (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                  <p className="text-[17px] font-bold text-foreground">
                    No saved scripts
                  </p>
                  <p className="max-w-md pt-1 text-[14px] text-muted-foreground">
                    Everything here is free — scripts you save from the
                    Marketplace will appear here.
                  </p>
                </div>
              ) : section === "fundamentals" ? (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                  <svg
                    aria-hidden
                    viewBox="0 0 120 90"
                    className="h-24 w-32 text-foreground"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  >
                    <ellipse cx="60" cy="34" rx="30" ry="12" />
                    <path d="M48 32a12 9 0 0 1 24 0" />
                    <circle cx="42" cy="34" r="1.5" fill="currentColor" />
                    <circle cx="78" cy="34" r="1.5" fill="currentColor" />
                    <path d="M50 44 32 80M70 44l18 36" />
                    <path d="M52 62l4-6 6 2 6-4 6 6 4-2" />
                    <path d="M54 70l-3 8M72 68l4 7" />
                  </svg>
                  <p className="pt-4 text-[15px] text-foreground">
                    {hasFundamentals
                      ? "Fundamental overlays are not available on the price chart yet."
                      : "This type of symbol doesn't have fundamental metrics"}
                  </p>
                </div>
              ) : section === "technicals" ? (
                pill === "strategies" ? (
                  <div className="px-2">
                    {STRATEGY_BUNDLES.filter((strategy) =>
                      strategy.name.toLowerCase().includes(needle),
                    ).map((strategy) => (
                      <div
                        key={strategy.name}
                        className="flex items-center justify-between gap-3 px-2 py-2 hover:bg-muted"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-foreground">
                            {strategy.name}
                          </p>
                          <p className="truncate text-[12px] text-muted-foreground">
                            {strategy.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            applyIds(strategy.ids, strategy.name)
                          }
                          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-[13px] font-semibold hover:bg-muted"
                        >
                          Apply
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-2">
                    {technicalRows().map(renderTechnicalRow)}
                    {technicalRows().length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {`No indicators match “${query}”.`}
                      </p>
                    )}
                  </div>
                )
              ) : searching ? (
                <div className="px-2">
                  <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Technicals
                  </p>
                  {TECHNICALS.filter((entry) =>
                    entry.name.toLowerCase().includes(needle),
                  ).map(renderTechnicalRow)}
                  <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Community
                  </p>
                  <div className="grid grid-cols-[1fr_110px_64px] gap-2 px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Script name</span>
                    <span className="text-right">Author</span>
                    <span className="text-right">Boosts</span>
                  </div>
                  {filteredCommunity(COMMUNITY).map(renderCommunityRow)}
                  {filteredCommunity(COMMUNITY).length === 0 &&
                    TECHNICALS.filter((entry) =>
                      entry.name.toLowerCase().includes(needle),
                    ).length === 0 &&
                    matches.length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {`No indicators match “${query}”.`}
                      </p>
                    )}
                </div>
              ) : (
                <div className="px-2">
                  <div className="grid grid-cols-[1fr_110px_64px] gap-2 px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Script name</span>
                    <span className="text-right">Author</span>
                    <span className="text-right">Boosts</span>
                  </div>
                  {filteredCommunity(communityFor(section)).map(
                    renderCommunityRow,
                  )}
                  {filteredCommunity(communityFor(section)).length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No scripts here yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
