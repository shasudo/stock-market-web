import { unwrapApiEnvelope } from "@/lib/api-envelope";

export interface DashboardTopPerformer {
  company: string;
  sector: string;
  ltp: number;
  percentInChange: number;
}

export interface DashboardStats {
  totalGainers: number;
  totalLosers: number;
  avgGain: number;
  avgLoss: number;
  lastSyncAt: string | null;
  topGainer: DashboardTopPerformer | null;
  topLoser: DashboardTopPerformer | null;
}

export interface DashboardStatsResponse {
  readonly stats: DashboardStats;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isTopPerformer(
  value: unknown,
): value is DashboardTopPerformer {
  return (
    isRecord(value) &&
    typeof value.company === "string" &&
    typeof value.sector === "string" &&
    typeof value.ltp === "number" &&
    typeof value.percentInChange === "number"
  );
}

export function isDashboardStats(value: unknown): value is DashboardStats {
  return (
    isRecord(value) &&
    typeof value.totalGainers === "number" &&
    typeof value.totalLosers === "number" &&
    typeof value.avgGain === "number" &&
    typeof value.avgLoss === "number" &&
    (value.lastSyncAt === null || typeof value.lastSyncAt === "string") &&
    (value.topGainer === null || isTopPerformer(value.topGainer)) &&
    (value.topLoser === null || isTopPerformer(value.topLoser))
  );
}

export function isDashboardStatsResponse(
  value: unknown,
): value is DashboardStatsResponse {
  // apiClient returns the Java envelope {success, message, data, errors};
  // unwrap first so the guard sees the bare {stats} payload.
  const body: unknown = unwrapApiEnvelope(value);
  return isRecord(body) && isDashboardStats(body.stats);
}

/**
 * Returns the stats payload from either the Java envelope or an already
 * unwrapped body, or null when the shape is unusable. Use the return value
 * directly — reading `.stats` off the raw axios payload yields `undefined`
 * because the envelope nests it under `data`.
 */
export function extractDashboardStats(value: unknown): DashboardStats | null {
  const body: unknown = unwrapApiEnvelope(value);
  return isRecord(body) && isDashboardStats(body.stats) ? body.stats : null;
}
