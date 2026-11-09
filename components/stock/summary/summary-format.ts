import type { StatementValueKind } from "@/lib/fundamentals/statement-tables";

export function fmtCr(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  const abs = Math.abs(value);
  if (abs >= 1e7) {
    return `₹${(value / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr.`;
  }
  if (abs >= 1e5) {
    return `₹${(value / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Lakh`;
  }
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function fmtPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  return `${value.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}%`;
}

export function fmtMult(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function fmtNum(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function fmtCell(
  kind: StatementValueKind,
  rowKey: string,
  value: number | null,
): string {
  if (value === null) return "—";
  if (rowKey === "eps") return `₹${fmtNum(value)}`;
  if (kind === "currency") return fmtCr(value);
  if (kind === "percent") return fmtPct(value);
  if (kind === "multiple") return fmtMult(value);
  return fmtNum(value, 0);
}

export function median(values: readonly (number | null)[]): number | null {
  const finite = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (finite.length === 0) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
