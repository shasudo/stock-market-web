import {
  SUPER_INVESTOR_CATEGORIES,
  type SuperInvestorCategory,
} from "./classify";

export function readCategory(url: URL): SuperInvestorCategory {
  const value = url.searchParams.get("category")?.toLowerCase() ?? "";
  return (SUPER_INVESTOR_CATEGORIES as readonly string[]).includes(value)
    ? (value as SuperInvestorCategory)
    : "public";
}

export function readLimit(url: URL, fallback: number, max: number): number {
  const parsed = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function readSearch(url: URL): string | undefined {
  const value = url.searchParams.get("search")?.trim() ?? "";
  return value ? value.slice(0, 80) : undefined;
}

/** Live prices move every minute; never let a proxy or the browser hold one. */
export const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
