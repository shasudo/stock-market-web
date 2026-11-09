import { TOOL_DEFINITIONS, type DrawingType } from "@/lib/chart/drawings";
import { SYNC_KEYS, queuePush } from "./chart-sync";

/** Starred drawing tools and starred shortcuts, saved with the account. */
export interface Favorites {
  readonly tools: readonly DrawingType[];
  readonly products: readonly string[];
}

export const EMPTY_FAVORITES: Favorites = { tools: [], products: [] };

const KNOWN_TOOLS = new Set<string>(TOOL_DEFINITIONS.map((tool) => tool.type));
const MAX_FAVORITES = 40;

export function sanitizeFavorites(value: unknown): Favorites {
  if (typeof value !== "object" || value === null) return EMPTY_FAVORITES;
  const input = value as { tools?: unknown; products?: unknown };
  const unique = <T>(items: readonly T[]): T[] =>
    [...new Set(items)].slice(0, MAX_FAVORITES);
  return {
    tools: unique(
      Array.isArray(input.tools)
        ? input.tools.filter(
            (entry): entry is DrawingType =>
              typeof entry === "string" && KNOWN_TOOLS.has(entry),
          )
        : [],
    ),
    products: unique(
      Array.isArray(input.products)
        ? input.products.filter(
            (entry): entry is string => typeof entry === "string",
          )
        : [],
    ),
  };
}

export function loadFavorites(): Favorites {
  try {
    const raw = window.localStorage.getItem(SYNC_KEYS.favorites);
    return raw ? sanitizeFavorites(JSON.parse(raw)) : EMPTY_FAVORITES;
  } catch {
    return EMPTY_FAVORITES;
  }
}

export function saveFavorites(favorites: Favorites): void {
  try {
    window.localStorage.setItem(SYNC_KEYS.favorites, JSON.stringify(favorites));
  } catch {
    // Favourites are a convenience.
  }
  queuePush("favorites", favorites);
}

export function toggleIn<T>(items: readonly T[], item: T): T[] {
  return items.includes(item)
    ? items.filter((entry) => entry !== item)
    : [...items, item];
}
