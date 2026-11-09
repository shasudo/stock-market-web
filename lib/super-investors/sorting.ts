/**
 * Column sorting for the Super Investors tables. Shared by the API (the
 * investor, key-change and common-stock lists are sorted over the whole
 * category before the row limit is applied) and the page (tables that are
 * fully loaded, like recent deals, sort in the browser).
 */

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  readonly key: K;
  readonly dir: SortDirection;
}

type SortValue = number | string | null;

/** Ascending or descending, with blanks (null / NaN) always at the bottom. */
export function compareValues(left: SortValue, right: SortValue, dir: SortDirection): number {
  const leftBlank = left === null || (typeof left === "number" && Number.isNaN(left));
  const rightBlank = right === null || (typeof right === "number" && Number.isNaN(right));
  if (leftBlank || rightBlank) return leftBlank === rightBlank ? 0 : leftBlank ? 1 : -1;
  const order =
    typeof left === "string" && typeof right === "string"
      ? left.localeCompare(right, "en", { sensitivity: "base", numeric: true })
      : (left as number) - (right as number);
  return dir === "asc" ? order : -order;
}

/** Stable sort by one column; rows that tie keep their incoming (default) order. */
export function sortRows<T>(
  rows: readonly T[],
  value: (row: T) => SortValue,
  dir: SortDirection,
): T[] {
  return rows
    .map((row, index) => ({ row, index, value: value(row) }))
    .sort((a, b) => compareValues(a.value, b.value, dir) || a.index - b.index)
    .map((entry) => entry.row);
}

export function readSortState<K extends string>(
  url: URL,
  keys: readonly K[],
): SortState<K> | null {
  const key = url.searchParams.get("sort");
  if (!key || !(keys as readonly string[]).includes(key)) return null;
  return { key: key as K, dir: url.searchParams.get("order") === "asc" ? "asc" : "desc" };
}

const CHANGE_RANK: Readonly<Record<string, number>> = {
  new: 0,
  increased: 1,
  unchanged: 2,
  decreased: 3,
  exited: 4,
};

/** new → increased → unchanged → decreased → exited (ascending). */
export function changeRank(change: string | null): number | null {
  return change === null ? null : (CHANGE_RANK[change] ?? null);
}

// ---------- Investors ----------

export const INVESTOR_SORT_KEYS = [
  "name",
  "holdings",
  "value",
  "dayChange",
  "moves",
  "topPerformer",
] as const;
export type InvestorSortKey = (typeof INVESTOR_SORT_KEYS)[number];

export interface InvestorSortable {
  readonly name: string;
  readonly holdingsCount: number;
  readonly value: number;
  readonly dayChange: number;
  readonly dayChangePct: number | null;
  readonly newCount: number;
  readonly increasedCount: number;
  readonly decreasedCount: number;
  readonly exitedCount: number;
  readonly topPerformer: { readonly change3mPct: number } | null;
}

export function investorSortValue(row: InvestorSortable, key: InvestorSortKey): SortValue {
  switch (key) {
    case "name":
      return row.name;
    case "holdings":
      return row.holdingsCount;
    case "value":
      return row.value;
    case "dayChange":
      return row.dayChangePct;
    case "moves":
      // Net buying: new + increased count up, decreased + exited count down.
      return row.newCount + row.increasedCount - row.decreasedCount - row.exitedCount;
    case "topPerformer":
      return row.topPerformer?.change3mPct ?? null;
  }
}

// ---------- Key changes ----------

export const CHANGE_SORT_KEYS = [
  "filed",
  "investor",
  "stock",
  "change",
  "stake",
  "price",
  "value",
] as const;
export type ChangeSortKey = (typeof CHANGE_SORT_KEYS)[number];

export interface ChangeSortable {
  readonly filedAt: string;
  readonly investorName: string;
  readonly companyName: string;
  readonly change: string;
  readonly percent: number;
  readonly previousPercent: number | null;
  readonly lastPrice: number | null;
  readonly value: number | null;
}

export function changeSortValue(row: ChangeSortable, key: ChangeSortKey): SortValue {
  switch (key) {
    case "filed":
      return row.filedAt;
    case "investor":
      return row.investorName;
    case "stock":
      return row.companyName;
    case "change":
      return changeRank(row.change);
    case "stake":
      // The size of the move in percentage points (exits count as a full sale).
      return row.percent - (row.previousPercent ?? 0);
    case "price":
      return row.lastPrice;
    case "value":
      return row.change === "exited" ? null : row.value;
  }
}

// ---------- Common stocks ----------

export const COMMON_SORT_KEYS = ["stock", "price", "holders", "combined", "heldBy"] as const;
export type CommonSortKey = (typeof COMMON_SORT_KEYS)[number];

export interface CommonSortable {
  readonly companyName: string;
  readonly lastPrice: number | null;
  readonly holders: readonly { readonly name: string; readonly percent: number }[];
  readonly combinedPercent: number;
}

export function commonSortValue(row: CommonSortable, key: CommonSortKey): SortValue {
  switch (key) {
    case "stock":
      return row.companyName;
    case "price":
      return row.lastPrice;
    case "holders":
      return row.holders.length;
    case "combined":
      return row.combinedPercent;
    case "heldBy":
      // Holders are listed largest stake first; sort by that lead holder.
      return row.holders[0]?.name ?? null;
  }
}

// ---------- Deals ----------

export const DEAL_SORT_KEYS = [
  "date",
  "investor",
  "stock",
  "deal",
  "quantity",
  "dealPrice",
  "dealValue",
  "livePrice",
] as const;
export type DealSortKey = (typeof DEAL_SORT_KEYS)[number];

export interface DealSortable {
  readonly dealDate: string;
  readonly investorName: string;
  readonly companyName: string;
  readonly dealType: string;
  readonly transactionType: string;
  readonly quantity: number;
  readonly price: number;
  readonly lastPrice: number | null;
}

export function dealSortValue(row: DealSortable, key: DealSortKey): SortValue {
  switch (key) {
    case "date":
      return row.dealDate;
    case "investor":
      return row.investorName;
    case "stock":
      return row.companyName;
    case "deal":
      return `${row.transactionType} ${row.dealType}`;
    case "quantity":
      return row.quantity;
    case "dealPrice":
      return row.price;
    case "dealValue":
      return row.quantity * row.price;
    case "livePrice":
      return row.lastPrice;
  }
}

/** First click on a text column sorts A→Z; on a number or date column, largest / newest first. */
export function defaultDirection(textual: boolean): SortDirection {
  return textual ? "asc" : "desc";
}

/** Next state when a header is clicked: a new column starts at its default; the same column flips. */
export function nextSort<K extends string>(
  current: SortState<K> | null,
  key: K,
  textual: boolean,
): SortState<K> {
  if (current?.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: defaultDirection(textual) };
}
