/**
 * Custom-date display helpers for the market calendar (DD/MM/YYYY inputs).
 * Pure functions kept outside the page component so they stay unit-tested.
 */

export interface ParsedDisplayDate {
  readonly iso: string;
  readonly valid: boolean;
}

export function toDisplayDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

/**
 * Today's date as YYYY-MM-DD in the browser's local timezone. The old
 * inline code used `toISOString()` (UTC), which is a day behind IST around
 * midnight and could reject a valid start date as "in the future".
 */
export function todayLocalIso(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

export interface ValidCustomDateRange {
  readonly startIso: string;
  readonly endIso: string;
}

export type CustomDateValidation =
  | { readonly ok: true; readonly range: ValidCustomDateRange }
  | { readonly ok: false; readonly error: string };

/**
 * Single place that decides whether the Customize Date inputs can be
 * applied. A start date alone is valid and means "start date vs today".
 */
export function validateCustomDateRange(
  startInput: string,
  endInput: string,
  todayIso: string,
): CustomDateValidation {
  const start = parseDisplayDate(startInput);
  const end = parseDisplayDate(endInput);
  if (!start.valid) {
    return { ok: false, error: "Invalid Start Date. Use DD/MM/YYYY." };
  }
  if (!end.valid) {
    return { ok: false, error: "Invalid End Date. Use DD/MM/YYYY." };
  }
  if (!start.iso && !end.iso) {
    return { ok: false, error: "Enter at least a Start Date." };
  }
  if (!start.iso) {
    return { ok: false, error: "Start Date is required." };
  }
  if (end.iso && start.iso > end.iso) {
    return { ok: false, error: "Start Date must be before End Date." };
  }
  if (start.iso > todayIso) {
    return { ok: false, error: "Start Date cannot be in the future." };
  }
  if (end.iso && end.iso > todayIso) {
    return { ok: false, error: "End Date cannot be in the future." };
  }
  return { ok: true, range: { startIso: start.iso, endIso: end.iso } };
}

export function parseDisplayDate(input: string): ParsedDisplayDate {
  const trimmed = input.trim();
  if (!trimmed) return { iso: "", valid: true };

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return { iso: "", valid: false };

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  ) {
    return { iso: "", valid: false };
  }

  return { iso: `${year}-${month}-${day}`, valid: true };
}
