/**
 * F&O market snapshot: pure parsing and arithmetic over NSE's F&O bhavcopy,
 * Dhan's futures quote packets and NSE's option chain / derivatives feeds.
 * No network or database access here, so all of it is unit-testable.
 */

export type ExpirySeries = "near" | "next" | "far";
export type Buildup = "long-buildup" | "short-buildup" | "short-covering" | "long-unwinding";

/** One contract from NSE's UDiFF F&O bhavcopy. */
export interface BhavRow {
  readonly tradeDate: string;
  readonly instrument: "IDF" | "STF" | "IDO" | "STO";
  readonly securityId: number;
  readonly symbol: string;
  readonly expiry: string;
  readonly strike: number | null;
  readonly optionType: "CE" | "PE" | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly close: number | null;
  readonly last: number | null;
  readonly prevClose: number | null;
  readonly underlying: number | null;
  readonly settle: number | null;
  readonly oi: number;
  readonly oiChange: number;
  /** Contracts traded (NSE's TtlTradgVol). */
  readonly contracts: number;
  /** Traded quantity (shares) = contracts × lot. */
  readonly volume: number;
  /** Traded value (₹); notional for options. */
  readonly value: number;
  readonly trades: number;
  readonly lotSize: number;
}

export interface Bhavcopy {
  readonly date: string;
  readonly rows: readonly BhavRow[];
}

/** The live fields of a Dhan /marketfeed/quote packet a futures board needs. */
export interface FuturesPacket {
  readonly ltp: number;
  readonly prevClose: number | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly change: number | null;
  readonly volume: number | null;
  readonly avgPrice: number | null;
  readonly oi: number | null;
  readonly bid: number | null;
  readonly ask: number | null;
  /** ISO date (IST) of the last trade, when Dhan sends it. */
  readonly tradeDate: string | null;
}

export interface FutureContract {
  readonly securityId: number;
  readonly symbol: string;
  readonly expiry: string;
  readonly lotSize: number;
}

export interface FutureRow {
  readonly securityId: number;
  readonly symbol: string;
  readonly name: string;
  readonly isIndex: boolean;
  readonly sector: string | null;
  readonly expiry: string;
  readonly series: ExpirySeries;
  readonly lotSize: number;
  readonly ltp: number | null;
  readonly change: number | null;
  readonly changePct: number | null;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly prevClose: number | null;
  readonly avgPrice: number | null;
  /** Traded quantity (shares). */
  readonly volume: number | null;
  readonly contracts: number | null;
  /** Traded value in ₹ lakh. */
  readonly turnoverLakh: number | null;
  readonly oi: number | null;
  readonly prevOi: number | null;
  readonly oiChange: number | null;
  readonly oiChangePct: number | null;
  readonly prevVolume: number | null;
  readonly bid: number | null;
  readonly ask: number | null;
  /** The underlying's cash / index value. */
  readonly spot: number | null;
  readonly spotChangePct: number | null;
  readonly basis: number | null;
  readonly basisPct: number | null;
  readonly buildup: Buildup | null;
}

export interface SpotQuote {
  readonly price: number;
  readonly changePct: number | null;
  readonly name: string | null;
  readonly sector: string | null;
}

function num(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value.replace(/,/g, "")) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function positive(value: unknown): number | null {
  const parsed = num(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

const MONTHS: Readonly<Record<string, string>> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/** "23-Nov-2026" / "23-11-2026" / "2026-11-23" / "23/11/2026 15:29:59" → "2026-11-23". */
export function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = /^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})/.exec(text);
  if (match) {
    const month = MONTHS[match[2]!.toUpperCase()];
    return month ? `${match[3]}-${month}-${match[1]!.padStart(2, "0")}` : null;
  }
  match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(text);
  if (match) return `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
  return null;
}

/** "2026-11-23" → "23-Nov-2026", the form NSE's option chain API takes. */
export function nseDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const name = Object.keys(MONTHS).find((key) => MONTHS[key] === month) ?? "JAN";
  return `${day}-${name.charAt(0)}${name.slice(1).toLowerCase()}-${year}`;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

const BHAV_INSTRUMENTS = new Set(["IDF", "STF", "IDO", "STO"]);

/** NSE's UDiFF common F&O bhavcopy CSV → contracts. */
export function parseBhavcopyCsv(csv: string): Bhavcopy | null {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return null;
  const header = splitCsvLine(lines[0]!);
  const at = (name: string) => header.indexOf(name);
  const column = {
    date: at("TradDt"),
    type: at("FinInstrmTp"),
    id: at("FinInstrmId"),
    symbol: at("TckrSymb"),
    expiry: at("XpryDt"),
    strike: at("StrkPric"),
    option: at("OptnTp"),
    open: at("OpnPric"),
    high: at("HghPric"),
    low: at("LwPric"),
    close: at("ClsPric"),
    last: at("LastPric"),
    prev: at("PrvsClsgPric"),
    underlying: at("UndrlygPric"),
    settle: at("SttlmPric"),
    oi: at("OpnIntrst"),
    oiChange: at("ChngInOpnIntrst"),
    volume: at("TtlTradgVol"),
    value: at("TtlTrfVal"),
    trades: at("TtlNbOfTxsExctd"),
    lot: at("NewBrdLotQty"),
  };
  if (column.type < 0 || column.symbol < 0 || column.expiry < 0 || column.oi < 0) return null;
  const rows: BhavRow[] = [];
  let date: string | null = null;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const instrument = cells[column.type];
    if (!instrument || !BHAV_INSTRUMENTS.has(instrument)) continue;
    const expiry = isoDate(cells[column.expiry]);
    const symbol = cells[column.symbol]?.toUpperCase();
    if (!expiry || !symbol) continue;
    const tradeDate = isoDate(cells[column.date]) ?? "";
    date ??= tradeDate || null;
    const option = cells[column.option];
    const lotSize = num(cells[column.lot]) ?? 0;
    const contracts = num(cells[column.volume]) ?? 0;
    rows.push({
      tradeDate,
      instrument: instrument as BhavRow["instrument"],
      securityId: num(cells[column.id]) ?? 0,
      symbol,
      expiry,
      strike: positive(cells[column.strike]),
      optionType: option === "CE" || option === "PE" ? option : null,
      open: positive(cells[column.open]),
      high: positive(cells[column.high]),
      low: positive(cells[column.low]),
      close: positive(cells[column.close]),
      last: positive(cells[column.last]),
      prevClose: positive(cells[column.prev]),
      underlying: positive(cells[column.underlying]),
      settle: positive(cells[column.settle]),
      oi: num(cells[column.oi]) ?? 0,
      oiChange: num(cells[column.oiChange]) ?? 0,
      contracts,
      volume: contracts * (lotSize > 0 ? lotSize : 1),
      value: num(cells[column.value]) ?? 0,
      trades: num(cells[column.trades]) ?? 0,
      lotSize,
    });
  }
  return date ? { date, rows } : null;
}

/** One Dhan /marketfeed/quote packet for an F&O contract. */
export function parseFuturesPacket(raw: unknown): FuturesPacket | null {
  const packet = record(raw);
  if (!packet) return null;
  const ltp = positive(packet.last_price);
  if (ltp === null) return null;
  const ohlc = record(packet.ohlc);
  const depth = record(packet.depth);
  const best = (side: unknown): number | null => (Array.isArray(side) ? positive(record(side[0])?.price) : null);
  const prevClose = positive(ohlc?.close);
  const change = num(packet.net_change) ?? (prevClose !== null ? ltp - prevClose : null);
  return {
    ltp,
    prevClose,
    open: positive(ohlc?.open),
    high: positive(ohlc?.high),
    low: positive(ohlc?.low),
    change,
    volume: num(packet.volume),
    avgPrice: positive(packet.average_price),
    oi: num(packet.oi),
    bid: best(depth?.buy),
    ask: best(depth?.sell),
    tradeDate: isoDate(packet.last_trade_time),
  };
}

/** Near / next / far month futures per underlying, by expiry. */
export function seriesByExpiry(contracts: readonly FutureContract[]): Map<number, ExpirySeries> {
  const bySymbol = new Map<string, FutureContract[]>();
  for (const contract of contracts) {
    const list = bySymbol.get(contract.symbol) ?? [];
    list.push(contract);
    bySymbol.set(contract.symbol, list);
  }
  const result = new Map<number, ExpirySeries>();
  const order: readonly ExpirySeries[] = ["near", "next", "far"];
  for (const list of bySymbol.values()) {
    list.sort((a, b) => a.expiry.localeCompare(b.expiry));
    list.slice(0, 3).forEach((contract, index) => result.set(contract.securityId, order[index]!));
  }
  return result;
}

/** Price and open interest moving together or apart. */
export function buildupOf(changePct: number | null, oiChange: number | null): Buildup | null {
  if (changePct === null || oiChange === null || changePct === 0 || oiChange === 0) return null;
  if (changePct > 0) return oiChange > 0 ? "long-buildup" : "short-covering";
  return oiChange > 0 ? "short-buildup" : "long-unwinding";
}

export interface BoardInput {
  readonly contracts: readonly FutureContract[];
  readonly packets: ReadonlyMap<number, FuturesPacket>;
  /** Today's session close, when NSE has published it (market closed). */
  readonly sessionBhav: Bhavcopy | null;
  /** The session before the one the live quotes belong to. */
  readonly referenceBhav: Bhavcopy | null;
  readonly spots: ReadonlyMap<string, SpotQuote>;
  readonly isIndex: (symbol: string) => boolean;
}

/**
 * Every futures contract with its live quote (or the session's close when
 * Dhan has none), open interest against the previous session, and the
 * underlying's cash value.
 */
export function buildFuturesBoard(input: BoardInput): FutureRow[] {
  const series = seriesByExpiry(input.contracts);
  const reference = new Map<number, BhavRow>();
  for (const row of input.referenceBhav?.rows ?? []) {
    if (row.instrument === "IDF" || row.instrument === "STF") reference.set(row.securityId, row);
  }
  const session = new Map<number, BhavRow>();
  for (const row of input.sessionBhav?.rows ?? []) {
    if (row.instrument === "IDF" || row.instrument === "STF") session.set(row.securityId, row);
  }

  const rows: FutureRow[] = [];
  for (const contract of input.contracts) {
    const position = series.get(contract.securityId);
    if (!position) continue;
    const packet = input.packets.get(contract.securityId) ?? null;
    const closed = session.get(contract.securityId) ?? null;
    const before = reference.get(contract.securityId) ?? null;
    const lotSize = contract.lotSize || closed?.lotSize || before?.lotSize || 0;

    const ltp = packet?.ltp ?? closed?.last ?? closed?.close ?? null;
    const prevClose = packet?.prevClose ?? closed?.prevClose ?? before?.close ?? null;
    const change = packet?.change ?? (ltp !== null && prevClose !== null ? ltp - prevClose : null);
    const changePct = change !== null && prevClose ? (change / prevClose) * 100 : null;
    const volume = packet?.volume ?? closed?.volume ?? null;
    const avgPrice = packet?.avgPrice ?? (closed && closed.volume > 0 ? closed.value / closed.volume : null);
    // Once NSE publishes the session's bhavcopy its closing OI is the official
    // figure; the feed's last tick can differ slightly after the close.
    const oi = closed?.oi ?? packet?.oi ?? null;
    const prevOi = before ? before.oi : closed ? closed.oi - closed.oiChange : null;
    const oiChange = oi !== null && prevOi !== null ? oi - prevOi : null;
    const spotQuote = input.spots.get(contract.symbol) ?? null;
    const spot = spotQuote?.price ?? closed?.underlying ?? null;
    const basis = ltp !== null && spot !== null ? ltp - spot : null;

    rows.push({
      securityId: contract.securityId,
      symbol: contract.symbol,
      name: spotQuote?.name ?? contract.symbol,
      isIndex: input.isIndex(contract.symbol),
      sector: spotQuote?.sector ?? null,
      expiry: contract.expiry,
      series: position,
      lotSize,
      ltp,
      change,
      changePct,
      open: packet?.open ?? closed?.open ?? null,
      high: packet?.high ?? closed?.high ?? null,
      low: packet?.low ?? closed?.low ?? null,
      prevClose,
      avgPrice,
      volume,
      contracts: volume !== null && lotSize > 0 ? Math.round(volume / lotSize) : null,
      turnoverLakh: volume !== null && avgPrice !== null ? (volume * avgPrice) / 1e5 : null,
      oi,
      prevOi,
      oiChange,
      oiChangePct: oiChange !== null && prevOi ? (oiChange / prevOi) * 100 : null,
      prevVolume: before?.volume ?? null,
      bid: packet?.bid ?? null,
      ask: packet?.ask ?? null,
      spot,
      spotChangePct: spotQuote?.changePct ?? null,
      basis,
      basisPct: basis !== null && spot ? (basis / spot) * 100 : null,
      buildup: buildupOf(changePct, oiChange),
    });
  }
  return rows;
}

export interface AdvanceDecline {
  readonly advanced: number;
  readonly declined: number;
  readonly unchanged: number;
  readonly total: number;
}

export function advanceDecline(changes: readonly (number | null)[]): AdvanceDecline {
  let advanced = 0;
  let declined = 0;
  let unchanged = 0;
  for (const change of changes) {
    if (change === null) continue;
    if (change > 0) advanced += 1;
    else if (change < 0) declined += 1;
    else unchanged += 1;
  }
  return { advanced, declined, unchanged, total: advanced + declined + unchanged };
}

/** Calls and puts that traded in a session, advancing vs declining on their close. */
export function optionBreadth(bhav: Bhavcopy): { calls: AdvanceDecline; puts: AdvanceDecline } {
  const change = (row: BhavRow) => (row.close !== null && row.prevClose !== null ? row.close - row.prevClose : null);
  const traded = bhav.rows.filter((row) => row.optionType !== null && row.volume > 0);
  return {
    calls: advanceDecline(traded.filter((row) => row.optionType === "CE").map(change)),
    puts: advanceDecline(traded.filter((row) => row.optionType === "PE").map(change)),
  };
}

export interface SegmentVolume {
  readonly segment: "Index Futures" | "Stock Futures" | "Index Options" | "Stock Options";
  readonly contracts: number;
  /** ₹ crore; notional value for options. */
  readonly turnoverCr: number;
  readonly oiContracts: number;
  readonly share: number;
}

const SEGMENT_NAMES: Readonly<Record<BhavRow["instrument"], SegmentVolume["segment"]>> = {
  IDF: "Index Futures",
  STF: "Stock Futures",
  IDO: "Index Options",
  STO: "Stock Options",
};

/** Contracts, turnover and open interest per F&O segment for a session. */
export function volumeBreakup(bhav: Bhavcopy): SegmentVolume[] {
  const totals = new Map<BhavRow["instrument"], { contracts: number; turnover: number; oi: number }>();
  for (const row of bhav.rows) {
    const entry = totals.get(row.instrument) ?? { contracts: 0, turnover: 0, oi: 0 };
    const lot = row.lotSize > 0 ? row.lotSize : 1;
    entry.contracts += row.contracts;
    entry.turnover += row.value;
    entry.oi += row.oi / lot;
    totals.set(row.instrument, entry);
  }
  const all = [...totals.values()].reduce((sum, entry) => sum + entry.contracts, 0);
  return (["IDF", "STF", "IDO", "STO"] as const).map((instrument) => {
    const entry = totals.get(instrument) ?? { contracts: 0, turnover: 0, oi: 0 };
    return {
      segment: SEGMENT_NAMES[instrument],
      contracts: Math.round(entry.contracts),
      turnoverCr: entry.turnover / 1e7,
      oiContracts: Math.round(entry.oi),
      share: all > 0 ? (entry.contracts / all) * 100 : 0,
    };
  });
}

export interface OptionLeg {
  readonly ltp: number | null;
  readonly change: number | null;
  readonly changePct: number | null;
  /** Open interest in contracts, as NSE publishes it. */
  readonly oi: number | null;
  readonly oiChange: number | null;
  readonly oiChangePct: number | null;
  readonly volume: number | null;
  readonly iv: number | null;
  readonly bid: number | null;
  readonly ask: number | null;
  readonly bidQty: number | null;
  readonly askQty: number | null;
}

export interface OptionChainRow {
  readonly strike: number;
  readonly call: OptionLeg | null;
  readonly put: OptionLeg | null;
}

export interface OptionChain {
  readonly symbol: string;
  readonly expiry: string;
  readonly underlyingValue: number | null;
  readonly asOf: string | null;
  readonly rows: readonly OptionChainRow[];
  readonly totals: { readonly callOi: number; readonly putOi: number; readonly callVolume: number; readonly putVolume: number };
  readonly pcr: number | null;
  readonly volumePcr: number | null;
  readonly maxPain: number | null;
  readonly atmStrike: number | null;
}

function leg(raw: unknown): OptionLeg | null {
  const value = record(raw);
  if (!value) return null;
  const oi = num(value.openInterest);
  const ltp = num(value.lastPrice);
  return {
    ltp: ltp !== null && ltp > 0 ? ltp : null,
    change: num(value.change),
    changePct: num(value.pChange) ?? num(value.PChange),
    oi,
    oiChange: num(value.changeinOpenInterest),
    oiChangePct: num(value.pchangeinOpenInterest),
    volume: num(value.totalTradedVolume),
    iv: positive(value.impliedVolatility),
    bid: positive(value.buyPrice1),
    ask: positive(value.sellPrice1),
    bidQty: num(value.buyQuantity1),
    askQty: num(value.sellQuantity1),
  };
}

/**
 * The strike at which option writers pay out least at expiry: for each
 * candidate settlement price, the intrinsic value of every open call and put.
 */
export function maxPain(rows: readonly OptionChainRow[]): number | null {
  const strikes = rows.filter((row) => (row.call?.oi ?? 0) > 0 || (row.put?.oi ?? 0) > 0);
  if (strikes.length === 0) return null;
  let best: { strike: number; pain: number } | null = null;
  for (const candidate of strikes) {
    let pain = 0;
    for (const row of strikes) {
      if (candidate.strike > row.strike) pain += (candidate.strike - row.strike) * (row.call?.oi ?? 0);
      if (candidate.strike < row.strike) pain += (row.strike - candidate.strike) * (row.put?.oi ?? 0);
    }
    if (!best || pain < best.pain) best = { strike: candidate.strike, pain };
  }
  return best?.strike ?? null;
}

/** NSE option-chain-v3 → one expiry's chain with PCR and max pain. */
export function parseOptionChain(payload: unknown, symbol: string, expiry: string): OptionChain | null {
  const records = record(record(payload)?.records);
  if (!records || !Array.isArray(records.data)) return null;
  const byStrike = new Map<number, { call: OptionLeg | null; put: OptionLeg | null }>();
  let underlying = positive(records.underlyingValue);
  for (const raw of records.data) {
    const item = record(raw);
    if (!item) continue;
    if (item.expiryDates !== undefined && isoDate(item.expiryDates) !== expiry) continue;
    const strike = positive(item.strikePrice);
    if (strike === null) continue;
    const entry = byStrike.get(strike) ?? { call: null, put: null };
    entry.call ??= leg(item.CE);
    entry.put ??= leg(item.PE);
    underlying ??= positive(record(item.CE)?.underlyingValue) ?? positive(record(item.PE)?.underlyingValue);
    byStrike.set(strike, entry);
  }
  const rows = [...byStrike.entries()].sort(([a], [b]) => a - b).map(([strike, legs]) => ({ strike, ...legs }));
  const totals = rows.reduce(
    (sum, row) => ({
      callOi: sum.callOi + (row.call?.oi ?? 0),
      putOi: sum.putOi + (row.put?.oi ?? 0),
      callVolume: sum.callVolume + (row.call?.volume ?? 0),
      putVolume: sum.putVolume + (row.put?.volume ?? 0),
    }),
    { callOi: 0, putOi: 0, callVolume: 0, putVolume: 0 },
  );
  let atmStrike: number | null = null;
  if (underlying !== null) {
    for (const row of rows) {
      if (atmStrike === null || Math.abs(row.strike - underlying) < Math.abs(atmStrike - underlying)) atmStrike = row.strike;
    }
  }
  return {
    symbol,
    expiry,
    underlyingValue: underlying,
    asOf: typeof records.timestamp === "string" ? records.timestamp : null,
    rows,
    totals,
    pcr: totals.callOi > 0 ? totals.putOi / totals.callOi : null,
    volumePcr: totals.callVolume > 0 ? totals.putVolume / totals.callVolume : null,
    maxPain: maxPain(rows),
    atmStrike,
  };
}

/** NSE option-chain-contract-info → expiries (ISO, ascending). */
export function parseContractInfo(payload: unknown): string[] {
  const dates = record(payload)?.expiryDates;
  if (!Array.isArray(dates)) return [];
  return [...new Set(dates.map(isoDate).filter((date): date is string => date !== null))].sort();
}

export interface ActiveOption {
  readonly symbol: string;
  readonly expiry: string;
  readonly optionType: "CE" | "PE";
  readonly strike: number;
  readonly ltp: number | null;
  readonly changePct: number | null;
  readonly contracts: number | null;
  /** Premium traded, ₹ lakh. */
  readonly premiumLakh: number | null;
  readonly oi: number | null;
  readonly underlyingValue: number | null;
}

/** NSE snapshot-derivatives-equity?index=calls|puts → most active by contracts. */
export function parseActiveOptions(payload: unknown): ActiveOption[] {
  const volume = record(record(payload)?.volume);
  const data = Array.isArray(volume?.data) ? volume.data : [];
  const result: ActiveOption[] = [];
  for (const raw of data) {
    const item = record(raw);
    if (!item) continue;
    const symbol = typeof item.underlying === "string" ? item.underlying : null;
    const expiry = isoDate(item.expiryDate);
    const strike = positive(item.strikePrice);
    const type = item.optionType === "Call" || item.optionType === "CE" ? "CE" : item.optionType === "Put" || item.optionType === "PE" ? "PE" : null;
    if (!symbol || !expiry || strike === null || !type) continue;
    const premium = num(item.premiumTurnover);
    result.push({
      symbol,
      expiry,
      optionType: type,
      strike,
      ltp: positive(item.lastPrice),
      changePct: num(item.pChange),
      contracts: num(item.numberOfContractsTraded),
      premiumLakh: premium !== null ? premium / 1e5 : null,
      oi: num(item.openInterest),
      underlyingValue: positive(item.underlyingValue),
    });
  }
  return result;
}

/** nsearchives fo_secban.csv → trade date and symbols. */
export function parseBanList(csv: string): { tradeDate: string | null; symbols: string[] } {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const heading = lines[0] ?? "";
  const tradeDate = isoDate(/(\d{1,2}-[A-Za-z]{3}-\d{4})/.exec(heading)?.[1] ?? "");
  const symbols = lines
    .slice(1)
    .map((line) => line.split(",").at(-1)?.trim().toUpperCase() ?? "")
    .filter((symbol) => /^[A-Z0-9&-]+$/.test(symbol));
  return { tradeDate, symbols };
}

export interface Announcement {
  readonly symbol: string;
  readonly company: string;
  readonly subject: string;
  readonly detail: string;
  readonly at: string;
  readonly url: string | null;
}

/** NSE corporate-announcements (all companies) → F&O companies' filings, newest first. */
export function parseAnnouncements(payload: unknown, symbols: ReadonlySet<string>, limit = 12): Announcement[] {
  if (!Array.isArray(payload)) return [];
  const result: Announcement[] = [];
  for (const raw of payload) {
    const item = record(raw);
    const symbol = typeof item?.symbol === "string" ? item.symbol.toUpperCase() : "";
    if (!item || !symbols.has(symbol)) continue;
    const url = typeof item.attchmntFile === "string" && /^https:\/\//.test(item.attchmntFile) ? item.attchmntFile : null;
    result.push({
      symbol,
      company: typeof item.sm_name === "string" ? item.sm_name : symbol,
      subject: typeof item.desc === "string" ? item.desc : "Announcement",
      detail: typeof item.attchmntText === "string" ? item.attchmntText : "",
      at: typeof item.an_dt === "string" ? item.an_dt : "",
      url,
    });
  }
  const time = (value: string) => {
    const iso = isoDate(value);
    const clock = /(\d{2}:\d{2}:\d{2})/.exec(value)?.[1] ?? "00:00:00";
    return iso ? Date.parse(`${iso}T${clock}+05:30`) : 0;
  };
  return result.sort((a, b) => time(b.at) - time(a.at)).slice(0, limit);
}

export interface CorporateAction {
  readonly symbol: string;
  readonly company: string;
  readonly exDate: string;
  readonly purpose: string;
}

/** NSE corporates-corporateActions → F&O companies' actions by ex-date. */
export function parseCorporateActions(payload: unknown, symbols: ReadonlySet<string>): CorporateAction[] {
  if (!Array.isArray(payload)) return [];
  const result: CorporateAction[] = [];
  for (const raw of payload) {
    const item = record(raw);
    const symbol = typeof item?.symbol === "string" ? item.symbol.toUpperCase() : "";
    const exDate = isoDate(item?.exDate);
    if (!item || !symbols.has(symbol) || !exDate) continue;
    result.push({
      symbol,
      company: typeof item.comp === "string" ? item.comp : symbol,
      exDate,
      purpose: typeof item.subject === "string" ? item.subject : "",
    });
  }
  return result.sort((a, b) => a.exDate.localeCompare(b.exDate) || a.symbol.localeCompare(b.symbol));
}
