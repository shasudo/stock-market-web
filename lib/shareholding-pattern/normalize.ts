import type { ShareholdingQuarter } from "./types";

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The wire shape drifts from the declared one: absent categories arrive
 * omitted (not null), and the public slice arrives as `publicShare`.
 * Normalize once at the boundary so every consumer below can rely on
 * `number | null` and never call number methods on `undefined`.
 */
export function normalizeShareholdingQuarter(
  value: unknown,
): ShareholdingQuarter | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.asOfDate !== "string") {
    return null;
  }
  return {
    asOfDate: record.asOfDate,
    promoters: toFiniteNumber(record.promoters),
    fiis: toFiniteNumber(record.fiis),
    diis: toFiniteNumber(record.diis),
    government: toFiniteNumber(record.government),
    public: toFiniteNumber(record.public) ?? toFiniteNumber(record.publicShare),
    others: toFiniteNumber(record.others),
    shareholders: toFiniteNumber(record.shareholders),
    filedAt: typeof record.filedAt === "string" ? record.filedAt : "",
    documentUrl:
      typeof record.documentUrl === "string" ? record.documentUrl : "",
  };
}
