"use client";

const STORAGE_KEY = "chart:indicator-favorites:v1";
const MAX_FAVORITES = 60;

/** Keep only non-empty string ids so a corrupt value cannot break the list. */
export function parseIndicatorFavorites(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === "string" && entry.length > 0 && !seen.has(entry)) {
      seen.add(entry);
      if (seen.size >= MAX_FAVORITES) break;
    }
  }
  return [...seen];
}

/** Toggle one id, keeping the original order and appending new stars at the end. */
export function toggleIndicatorFavorite(
  current: readonly string[],
  definitionId: string,
): string[] {
  const next = parseIndicatorFavorites(current);
  if (next.includes(definitionId)) {
    return next.filter((entry) => entry !== definitionId);
  }
  return [...next, definitionId].slice(0, MAX_FAVORITES);
}

export function loadIndicatorFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseIndicatorFavorites(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveIndicatorFavorites(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(parseIndicatorFavorites(ids)),
    );
  } catch {
    // Favorites are a convenience; blocked storage must not break the dialog.
  }
}
