import type { Candle, NullableNumber } from "@/lib/technical/types";
import { requireIndicatorDefinition } from "@/lib/technical/indicator-catalog";
import { maximumDrawdown } from "@/lib/technical/indicators";
import type { PartialBookingConfig, StopLossConfig } from "./types";

export type ExitReason =
  | "stopLoss"
  | "trailingStop"
  | "partialBooking"
  | "signal"
  | "endOfData";

export interface SimulatedTrade {
  readonly entryIndex: number;
  readonly entryDate: string;
  readonly entryPrice: number;
  readonly exitIndex: number;
  readonly exitDate: string;
  readonly exitPrice: number;
  readonly exitReason: ExitReason;
  readonly quantity: number;
  readonly pnl: number;
  readonly pnlPercent: number;
}

export interface SimulationSummary {
  readonly totalTrades: number;
  readonly winningTrades: number;
  readonly losingTrades: number;
  readonly winRate: number | null;
  readonly totalPnl: number;
  readonly totalPnlPercent: number;
  readonly maxDrawdownPercent: number | null;
  readonly finalCapital: number;
}

export interface SimulationResult {
  readonly trades: readonly SimulatedTrade[];
  readonly summary: SimulationSummary;
  readonly equityCurve: readonly number[];
}

export interface RiskConfig {
  readonly initialStopLoss: StopLossConfig;
  readonly trailingStopLoss: StopLossConfig;
  readonly partialBooking: PartialBookingConfig;
}

interface OpenPosition {
  entryIndex: number;
  entryPrice: number;
  quantity: number;
  initialStopPrice: number | null;
  trailingStopPrice: number | null;
  partialBooked: boolean;
  highestClose: number;
}

/** Long-only, single-position-at-a-time simulator: buy/exit are boolean
 * signal series (AND-ed conditions from the rule evaluator), while
 * stop-loss/trailing-stop/partial-booking are risk parameters computed
 * procedurally — not arbitrary conditions — since that is what they mean in
 * every real trading system, and it avoids needing a stateful expression
 * engine to express "value at entry index". */
export function runSimulation(
  candles: readonly Candle[],
  buySignal: readonly boolean[],
  exitSignal: readonly boolean[],
  risk: RiskConfig,
  initialCapital: number,
): SimulationResult {
  const initialAtrSeries = resolveAtrSeriesForConfig(candles, risk.initialStopLoss);
  const trailingAtrSeries = resolveAtrSeriesForConfig(candles, risk.trailingStopLoss);

  const trades: SimulatedTrade[] = [];
  const equityCurve: number[] = [];
  let capital = initialCapital;
  let position: OpenPosition | null = null;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];

    if (position) {
      position.highestClose = Math.max(position.highestClose, candle.close);
      if (risk.trailingStopLoss.kind !== "none") {
        position.trailingStopPrice = computeStopPrice(
          risk.trailingStopLoss,
          position.highestClose,
          trailingAtrSeries,
          index,
        );
      }

      const stopPrice = tighterStop(
        position.initialStopPrice,
        position.trailingStopPrice,
      );

      if (stopPrice !== null && candle.low <= stopPrice) {
        const exitReason: ExitReason =
          position.trailingStopPrice !== null && stopPrice === position.trailingStopPrice
            ? "trailingStop"
            : "stopLoss";
        trades.push(
          closeTrade(candles, position, index, stopPrice, exitReason, position.quantity),
        );
        capital += position.quantity * (stopPrice - position.entryPrice);
        position = null;
      } else if (
        !position.partialBooked &&
        risk.partialBooking.kind === "targetPercent" &&
        candle.high >= position.entryPrice * (1 + risk.partialBooking.percent / 100)
      ) {
        const targetPrice = position.entryPrice * (1 + risk.partialBooking.percent / 100);
        const bookedQuantity = position.quantity * risk.partialBooking.bookFraction;
        trades.push(
          closeTrade(candles, position, index, targetPrice, "partialBooking", bookedQuantity),
        );
        capital += bookedQuantity * (targetPrice - position.entryPrice);
        position.quantity -= bookedQuantity;
        position.partialBooked = true;
        if (position.quantity <= 0) position = null;
      } else if (exitSignal[index]) {
        trades.push(
          closeTrade(candles, position, index, candle.close, "signal", position.quantity),
        );
        capital += position.quantity * (candle.close - position.entryPrice);
        position = null;
      } else if (index === candles.length - 1) {
        trades.push(
          closeTrade(candles, position, index, candle.close, "endOfData", position.quantity),
        );
        capital += position.quantity * (candle.close - position.entryPrice);
        position = null;
      }
    } else if (buySignal[index] && candle.close > 0) {
      position = {
        entryIndex: index,
        entryPrice: candle.close,
        quantity: capital / candle.close,
        initialStopPrice: computeStopPrice(
          risk.initialStopLoss,
          candle.close,
          initialAtrSeries,
          index,
        ),
        trailingStopPrice: null,
        partialBooked: false,
        highestClose: candle.close,
      };
    }

    const openPnl = position ? position.quantity * (candle.close - position.entryPrice) : 0;
    equityCurve.push(capital + openPnl);
  }

  return {
    trades,
    summary: summarize(trades, initialCapital),
    equityCurve,
  };
}

function closeTrade(
  candles: readonly Candle[],
  position: OpenPosition,
  exitIndex: number,
  exitPrice: number,
  exitReason: ExitReason,
  quantity: number,
): SimulatedTrade {
  return {
    entryIndex: position.entryIndex,
    entryDate: toDateString(candles[position.entryIndex].timestamp),
    entryPrice: position.entryPrice,
    exitIndex,
    exitDate: toDateString(candles[exitIndex].timestamp),
    exitPrice,
    exitReason,
    quantity,
    pnl: quantity * (exitPrice - position.entryPrice),
    pnlPercent: ((exitPrice - position.entryPrice) / position.entryPrice) * 100,
  };
}

function resolveAtrSeriesForConfig(
  candles: readonly Candle[],
  config: StopLossConfig,
): readonly NullableNumber[] | null {
  if (config.kind !== "atrMultiple") return null;
  const definition = requireIndicatorDefinition("atr");
  const seriesMap = definition.compute(candles, { length: config.atrLength });
  return seriesMap.atr ?? null;
}

function computeStopPrice(
  config: StopLossConfig,
  referencePrice: number,
  atrSeries: readonly NullableNumber[] | null,
  index: number,
): number | null {
  if (config.kind === "none") return null;
  if (config.kind === "percent") return referencePrice * (1 - config.percent / 100);
  const atr = atrSeries?.[index] ?? null;
  return atr === null ? null : referencePrice - config.multiple * atr;
}

/** For a long position, the stop that triggers first as price falls is the
 * higher of the two — an initial stop is fixed below entry, a trailing stop
 * only ever rises, so once it overtakes the initial stop it becomes the
 * effective one. */
function tighterStop(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

function summarize(
  trades: readonly SimulatedTrade[],
  initialCapital: number,
): SimulationSummary {
  const winningTrades = trades.filter((trade) => trade.pnl > 0).length;
  const losingTrades = trades.filter((trade) => trade.pnl < 0).length;
  const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);

  return {
    totalTrades: trades.length,
    winningTrades,
    losingTrades,
    winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : null,
    totalPnl,
    totalPnlPercent: initialCapital > 0 ? (totalPnl / initialCapital) * 100 : 0,
    maxDrawdownPercent: worstDrawdown(trades, initialCapital),
    finalCapital: initialCapital + totalPnl,
  };
}

function worstDrawdown(
  trades: readonly SimulatedTrade[],
  initialCapital: number,
): number | null {
  if (trades.length === 0) return null;
  let capital = initialCapital;
  const closedEquity: number[] = [initialCapital];
  for (const trade of trades) {
    capital += trade.pnl;
    closedEquity.push(capital);
  }
  const drawdowns = maximumDrawdown(closedEquity);
  return drawdowns.reduce<number | null>((worst, value) => {
    if (value === null) return worst;
    return worst === null ? value : Math.min(worst, value);
  }, null);
}

function toDateString(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toISOString().slice(0, 10);
}
